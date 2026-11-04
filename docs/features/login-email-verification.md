# Email verification for fresh logins

Status: implemented locally; requires the database changes, Edge Function deployments and secrets below. No live Supabase settings were changed while implementing this feature.

## User flow

1. Sign in with email/password (or Google).
2. Rollin automatically emails a six-digit login code to the confirmed account email.
3. Enter the code on **Verify your login**. After approval, continue to onboarding or the app.
4. Closing and reopening the app keeps an approved session signed in. Logout or another device creates a new session that needs its own code.

Codes expire after ten minutes and are single-use. Five wrong guesses invalidate that challenge. Resending replaces the previous code, with a 60-second cooldown and limits of five sends per 15 minutes and 20 per day per account. These are code protections, not the deferred password-attempt lockout feature.

**Back to login** signs out only this device. Existing signup-confirmation and password-reset emails retain their current Supabase templates. A signup that creates a new session also reaches the login-code screen. Password recovery remains accessible, then signs out after changing the password.

## Turning the login code on or off

One database switch decides whether fresh logins need the emailed code. It's on by default.
Apply `supabase/migrations/20261030130000_login_code_toggle.sql` once (after the two
login-email migrations), then flip it in the Supabase SQL editor:

```sql
-- Password (or Google) sign-in only:
update login_security.settings set require_login_code = false;
-- Require the emailed code again:
update login_security.settings set require_login_code = true;
```

- **Off:** `login_email_verified()` approves any live Auth session, so the app skips **Verify
  your login** and the API, RLS and Edge Function checks all pass without a code. Signing out
  or revoking a session still blocks it.
- **On:** a session needs a verified code, exactly as described above. Sessions that signed in
  while the switch was off were never verified: their requests are blocked right away, and
  the app shows the code screen on its next launch or sign-in.
- No app release or redeploy is needed. The app asks the server on sign-in and launch, so a
  change applies to the next sign-in, relaunch, or session refresh. A device that is open at
  the moment of the switch keeps its current screen until then.
- The switch lives in the private `login_security` schema: clients can't read or change it.

## Security scope

This is custom email verification for access to Rollin, not Supabase native MFA/AAL2. Supabase issues an AAL1 session after the primary sign-in. Approval is stored on the server against that session ID and current email; neither client storage nor editable user metadata can approve it.

After activation, the Data API pre-request check blocks unverified authenticated requests, including security-definer RPCs and views. Restrictive RLS policies add checks to existing public tables, Storage objects and Realtime private-message authorization. Five user-facing Edge Functions also check approval before privileged actions. The status RPC and code function remain available to pending sessions. Existing ownership/driver/participant checks still apply after email verification.

**Limitation:** this does not add a second-factor requirement to Supabase Auth's own account-management endpoints. A person with the password can still obtain an underlying Auth session and perform operations Auth permits at AAL1, potentially including password changes. Public/anonymous content also remains public. Do not describe this as native MFA or complete protection against account takeover. Native Supabase MFA or a different authentication architecture is needed to cover that boundary.

Future user-facing Edge Functions must call `requireVerifiedLogin` before privileged operations. New tables need the restrictive policy below, in addition to their normal access policies, especially when accessed through Realtime/Storage rather than REST:

```sql
create policy require_login_email on public.YOUR_TABLE
as restrictive for all to authenticated
using ((select public.login_email_verified()))
with check ((select public.login_email_verified()));
```

## Setup and rollout

Use a test Supabase project first if available. **Activating enforcement affects everyone using that Supabase project. Older app versions cannot complete fresh logins afterward.** Make the updated app available to teammates before activating it on the shared project. Sessions that already exist when the core migration runs are explicitly approved once to preserve current logins; future sessions are not.

1. In Supabase **SQL Editor**, run `supabase/migrations/202610140001_login_email.sql` once. It creates the private verification tables and service-only verification functions. Do not run the enforcement file yet. Use your team's normal migration workflow instead if the project's remote migration history is already synchronized; do not blindly apply unrelated historical migrations.

2. In Supabase **Edge Functions → Secrets**, add:

   | Name | Value |
   | --- | --- |
   | `RESEND_API_KEY` | A Resend API key with permission to send from the verified Rollin domain. Reuse the existing server secret if already configured. |
   | `LOGIN_EMAIL_FROM` | `Rollin <no-reply@rollin-app.org>` |
   | `LOGIN_CODE_SECRET` | A new random secret of at least 32 characters. Generate 32 random bytes with the command below. |

   ```powershell
   node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex'))"
   ```

   Copy the generated value directly into the Supabase secret field. Do not paste these secrets into chat, source files, or `EXPO_PUBLIC_` variables. The Edge Function's Supabase URL and service-role credentials are supplied by Supabase. Your existing Auth SMTP/Resend configuration is separate: this function sends through Resend's API and does not use the Auth email templates. No template edit is needed.

3. Deploy the new function and all five updated user-facing functions. Replace `YOUR_PROJECT_REF` with the intended Supabase project's reference ID. These commands deploy backend code; they do not commit or push Git changes.

   ```powershell
   npx supabase login
   npx supabase functions deploy login-email --project-ref YOUR_PROJECT_REF
   npx supabase functions deploy announce --project-ref YOUR_PROJECT_REF
   npx supabase functions deploy leave-activity --project-ref YOUR_PROJECT_REF
   npx supabase functions deploy ride-route --project-ref YOUR_PROJECT_REF
   npx supabase functions deploy notify-message --project-ref YOUR_PROJECT_REF
   npx supabase functions deploy didit-create-session --project-ref YOUR_PROJECT_REF
   ```

   `supabase/config.toml` disables gateway JWT verification for `login-email` only. That function validates the bearer token itself through `getUser` and `getClaims`, then the database checks the session still exists. Do not disable authentication checks inside the function.

4. Start the updated app and test a fresh login, email delivery, code rejection and successful verification. At this stage the new app checks approval, but blanket database enforcement has not been activated yet.

5. Once the functions and updated app are ready, run `supabase/migrations/202610140002_enforce_login_email.sql` once in SQL Editor. It adds API/RLS enforcement and reloads the API configuration. If another pre-request hook is configured, the script deliberately fails rather than replacing it; combine the hooks before retrying. Run the whole file as one transaction through the migration runner/SQL Editor.

6. Repeat login testing with enforcement active. Check activities, rides, chats/announcements, private uploads and driver verification. Confirm a pending session can call only the approval check through the Data API, cannot read protected rows or invoke user-facing functions, and starts working after entering the correct code. Check another device still needs its own code. Refresh/reopen the approved device and verify no new prompt appears.

Email delivery uses your Resend sending allowance and function calls use your Supabase allowance. This feature does not require a paid Auth hook, but delivery is subject to the project's actual provider limits.

## Local validation

```powershell
npm install --prefix .expo/login-security-validation --no-package-lock --ignore-scripts @electric-sql/pglite@0.5.9
$env:PGLITE_MODULE = (Resolve-Path '.expo/login-security-validation/node_modules/@electric-sql/pglite').Path
node --test scripts/test-*.cjs
npx tsc --noEmit
npx expo export --platform android --output-dir .expo/login-email-export
```

The SQL tests execute both migrations against an isolated in-memory PostgreSQL instance with test Auth/Storage/Realtime schemas. They do not connect to Supabase. Handler tests mock Resend and Auth; they do not send emails. These checks cannot confirm the live project's policies, secrets, domain configuration, mobile appearance or actual email delivery. The rollout checks above are still required.
