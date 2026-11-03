
import { createClient } from 'npm:@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function respond(body: object, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

// Admin client for protected backend operations.
const admin = createClient(supabaseUrl, serviceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

Deno.serve(async (req) => {
  // Allow browser and mobile preflight requests.
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  if (req.method !== 'POST') {
    return respond({ error: 'Method not allowed.' }, 405);
  }

  try {
    // 1. Get the signed-in user's access token.
    const authorization =
      req.headers.get('Authorization') ?? '';

    if (!authorization.startsWith('Bearer ')) {
      return respond({
        error: 'Sign in first.',
      }, 401);
    }

    const token = authorization.slice(7).trim();

    if (!token) {
      return respond({
        error: 'Invalid session. Sign in again.',
      }, 401);
    }

    // 2. Verify the user using Supabase Auth.
    const { data: authData, error: authError } =
      await admin.auth.getUser(token);

    const user = authData.user;

    if (authError || !user || !user.email) {
      return respond({
        error: 'Invalid session. Sign in again.',
      }, 401);
    }

    // 3. Create a client that uses the user's JWT.
    // This allows the database to identify the session.
    const userClient = createClient(supabaseUrl, anonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // 4. Check Roli's six-digit login verification.
    const { data: verified, error: verificationError } =
      await userClient.rpc('login_email_verified');

    if (verificationError) {
      console.error(
        'Login verification check failed:',
        verificationError
      );

      return respond({
        error: 'Unable to verify your login session.',
      }, 403);
    }

    if (verified !== true) {
      return respond({
        error: 'Complete email login verification first.',
      }, 403);
    }

    // 5. Read the account deletion request.
    let body: Record<string, unknown>;

    try {
      const parsed = await req.json();

      if (
        !parsed ||
        typeof parsed !== 'object' ||
        Array.isArray(parsed)
      ) {
        return respond({
          error: 'Invalid request.',
        }, 400);
      }

      body = parsed as Record<string, unknown>;
    } catch {
      return respond({
        error: 'Invalid request.',
      }, 400);
    }

    const {
      action,
      password,
      confirmation,
      expected_user_id,
    } = body;

    if (action !== 'delete') {
      return respond({
        error: 'Invalid account action.',
      }, 400);
    }

    // Make sure the account being deleted is the caller's.
    if (expected_user_id !== user.id) {
      return respond({
        error: 'Account changed. Sign in again.',
      }, 403);
    }

    // Require the exact confirmation phrase.
    if (confirmation !== 'DELETE') {
      return respond({
        error: 'Type DELETE to confirm account deletion.',
      }, 400);
    }

    if (
      typeof password !== 'string' ||
      password.length === 0 ||
      password.length > 1024
    ) {
      return respond({
        error: 'Enter your password.',
      }, 400);
    }

    // 6. Recheck the password using a separate client.
    const passwordClient = createClient(supabaseUrl, anonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data: passwordData, error: passwordError } =
      await passwordClient.auth.signInWithPassword({
        email: user.email,
        password,
      });

    // Attempt to close the temporary session even if
    // the password belongs to a different account.
    const temporarySession = passwordData.session;

    if (
      passwordError ||
      !passwordData.user ||
      passwordData.user.id !== user.id
    ) {
      if (temporarySession) {
        const { error: cleanupError } =
          await passwordClient.auth.signOut({
            scope: 'local',
          });

        if (cleanupError) {
          console.error(
            'Temporary session cleanup failed:',
            cleanupError
          );
        }
      }

      return respond({
        error: 'Incorrect password.',
      }, 401);
    }

    // Sign out the temporary password-check session.
    if (!temporarySession) {
      return respond({
        error: 'Unable to complete password verification.',
      }, 401);
    }

    const { error: signOutError } =
      await passwordClient.auth.signOut({
        scope: 'local',
      });

    if (signOutError) {
      console.error(
        'Temporary session sign-out failed:',
        signOutError
      );

      return respond({
        error: 'Unable to finish identity verification. Retry.',
      }, 500);
    }

    // 7. Prepare deletion and check for ongoing rides.
    // This function runs using the backend service role.
    const { error: beginError } = await admin.rpc(
      'rollin_begin_delete',
      {
        target_id: user.id,
      }
    );

    if (beginError) {
      const message = beginError.message.toLowerCase();

      if (message.includes('ongoing ride')) {
        return respond({
          error:
            'Finish your ongoing ride before deleting your account.',
        }, 409);
      }

      console.error(
        'Unable to prepare account deletion:',
        beginError
      );

      return respond({
        error: 'Unable to prepare account deletion.',
      }, 500);
    }

    // 8. Remove Storage files in batches.
    // The SQL function returns up to 200 matching files.
    const maxBatches = 100;

    for (let batch = 0; batch < maxBatches; batch++) {
      const { data: files, error: filesError } =
        await admin.rpc('rollin_delete_files', {
          target_id: user.id,
          project_url: supabaseUrl,
        });

      if (filesError || !Array.isArray(files)) {
        console.error(
          'Unable to load account files:',
          filesError
        );

        return respond({
          error: 'Unable to finish file cleanup. Retry deletion.',
        }, 500);
      }

      // All matching files have been removed.
      if (files.length === 0) {
        break;
      }

      // Group paths by their Storage bucket.
      const byBucket = new Map<string, string[]>();

      for (const file of files) {
        if (
          typeof file.bucket_id !== 'string' ||
          !file.bucket_id ||
          typeof file.name !== 'string' ||
          !file.name
        ) {
          return respond({
            error: 'Invalid storage file information.',
          }, 500);
        }

        const paths = byBucket.get(file.bucket_id) ?? [];

        paths.push(file.name);

        byBucket.set(file.bucket_id, paths);
      }

      // Remove matching files from each bucket.
      for (const [bucket, paths] of byBucket) {
        // Delete in smaller groups to avoid large requests.
        for (let i = 0; i < paths.length; i += 100) {
          const chunk = paths.slice(i, i + 100);

          const { error: removeError } =
            await admin.storage
              .from(bucket)
              .remove(chunk);

          if (removeError) {
            console.error(
              'Storage removal failed:',
              removeError
            );

            return respond({
              error:
                'Unable to finish file cleanup. Retry deletion.',
            }, 500);
          }
        }
      }
    }

    // 9. Confirm that no matching files remain.
    // Do not delete Auth if storage cleanup is incomplete.
    const {
      data: remainingFiles,
      error: remainingError,
    } = await admin.rpc('rollin_delete_files', {
      target_id: user.id,
      project_url: supabaseUrl,
    });

    if (
      remainingError ||
      !Array.isArray(remainingFiles)
    ) {
      console.error(
        'Final storage verification failed:',
        remainingError
      );

      return respond({
        error: 'Unable to verify file cleanup. Retry deletion.',
      }, 500);
    }

    if (remainingFiles.length > 0) {
      return respond({
        error: 'More files remain. Retry deletion.',
      }, 503);
    }

    // 10. Permanently delete the Supabase Auth user.
    // Database foreign-key rules handle dependent records.
    const { error: deleteError } =
      await admin.auth.admin.deleteUser(user.id);

    if (deleteError) {
      console.error(
        'Auth account deletion failed:',
        deleteError
      );

      return respond({
        error:
          'Unable to finish account deletion. Retry deletion.',
      }, 500);
    }

    // 11. Notify the frontend only after Auth deletion.
    return respond({
      deleted: true,
    });

  } catch (error) {
    console.error(
      'Unexpected account deletion error:',
      error
    );

    return respond({
      error: 'Account deletion failed. Please retry.',
    }, 500);
  }
});
