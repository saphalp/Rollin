import { createClient } from 'npm:@supabase/supabase-js@2.110.2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const reply = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: cors });

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return reply({ error: 'Use POST.' }, 405);

  try {
    const authorization = req.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer ')) {
      return reply({ error: 'Sign in to leave an activity.' }, 401);
    }
    const client = createClient(
      Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authorization } },
        auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) return reply({ error: 'Sign in again to leave an activity.' }, 401);

    const body = await req.json().catch(() => null);
    if (typeof body?.activityId !== 'string' ||
        !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(body.activityId)) {
      return reply({ error: 'A valid activity ID is required.' }, 400);
    }
    const activityId = body.activityId;

    // 1. Remove the caller's RSVP (as the caller, so normal rules apply).
    const { error: leaveError } = await client
      .from('rsvps')
      .delete()
      .eq('activity_id', activityId)
      .eq('user_id', user.id);
    if (leaveError) return reply({ error: 'Could not leave the activity.' }, 500);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    // 2. Check whether a spot is now open.
    const { data: activity } = await admin
      .from('activities')
      .select('title, host_id, max_attendees, rsvps(user_id)')
      .eq('id', activityId)
      .single();
    if (!activity) return reply({ ok: true, promoted: null });

    const attendeeIds = (activity.rsvps ?? []).map((r) => r.user_id);
    if (attendeeIds.length >= activity.max_attendees) {
      return reply({ ok: true, promoted: null });
    }

    // 3. Find the first person in line who isn't already attending.
    const { data: line } = await admin
      .from('waitlist')
      .select('id, user_id')
      .eq('activity_id', activityId)
      .order('joined_at', { ascending: true });
    const next = (line ?? []).find((w) => !attendeeIds.includes(w.user_id));
    if (!next) return reply({ ok: true, promoted: null });

    // 4. Move them from the waitlist into the activity.
    const { error: promoteError } = await admin
      .from('rsvps')
      .insert({ activity_id: activityId, user_id: next.user_id });
    if (promoteError) return reply({ error: 'Could not promote the next person.' }, 500);

    await admin.from('waitlist').delete().eq('id', next.id);

    // 5. Tell them: in-app notification + push.
    const message = `A spot opened up! You're now going to ${activity.title}.`;

    await admin.from('notifications').insert({
      user_id: next.user_id,
      actor_id: activity.host_id,
      activity_id: activityId,
      type: 'waitlist_promoted',
      message,
    });

    const { data: tokens } = await admin
      .from('push_tokens')
      .select('expo_push_token')
      .eq('profile_id', next.user_id);

    const messages = (tokens ?? []).map((t) => ({
      to: t.expo_push_token,
      title: "You're in!",
      body: message,
      sound: 'default',
      data: { type: 'waitlist_promoted', activityId },
    }));
    if (messages.length > 0) {
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(messages),
      });
    }

    return reply({ ok: true, promoted: next.user_id });
  } catch (error) {
    return reply({ error: 'Something went wrong.' }, 500);
  }
});