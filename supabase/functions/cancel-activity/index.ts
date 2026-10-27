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
    if (!authorization?.startsWith('Bearer ')) return reply({ error: 'Sign in first.' }, 401);

    const client = createClient(
      Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authorization } },
        auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) return reply({ error: 'Sign in again.' }, 401);

    const body = await req.json().catch(() => null);
    if (typeof body?.activityId !== 'string' ||
        !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(body.activityId)) {
      return reply({ error: 'A valid activity ID is required.' }, 400);
    }
    const activityId = body.activityId;
    const reason = typeof body?.message === 'string' ? body.message.trim().slice(0, 500) : '';

    // 1. Only the host can cancel.
    const { data: activity } = await client
      .from('activities')
      .select('id, title, host_id, status')
      .eq('id', activityId)
      .single();
    if (!activity) return reply({ error: 'Activity not found.' }, 404);
    if (activity.host_id !== user.id) {
      return reply({ error: 'Only the host can cancel this activity.' }, 403);
    }
    if (activity.status === 'cancelled') return reply({ ok: true, sent: 0 });

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    // 2. Mark it cancelled.
    const { error: updateError } = await admin
      .from('activities')
      .update({
        status: 'cancelled',
        cancel_reason: reason || null,
        cancelled_at: new Date().toISOString(),
      })
      .eq('id', activityId);
    if (updateError) return reply({ error: 'Could not cancel the activity.' }, 500);

    // 3. Find everyone who RSVP'd.
    const { data: members } = await admin
      .from('rsvps')
      .select('user_id')
      .eq('activity_id', activityId);
    const memberIds = (members ?? [])
      .map((m) => m.user_id)
      .filter((id) => id !== user.id);
    if (memberIds.length === 0) return reply({ ok: true, sent: 0 });

    // 4. In-app notification for each attendee.
    const message = reason
      ? `${activity.title} was cancelled: ${reason}`
      : `${activity.title} was cancelled.`;

    await admin.from('notifications').insert(
      memberIds.map((id) => ({
        user_id: id,
        actor_id: user.id,
        activity_id: activityId,
        type: 'activity_cancelled',
        message,
      })),
    );

    // 5. Push notification.
    const { data: tokens } = await admin
      .from('push_tokens')
      .select('expo_push_token')
      .in('profile_id', memberIds);

    const pushTokens = [...new Set((tokens ?? []).map((t) => t.expo_push_token))];
    const messages = pushTokens.map((to) => ({
      to,
      title: 'Event cancelled',
      body: message,
      sound: 'default',
      data: { type: 'activity_cancelled', activityId },
    }));

    for (let i = 0; i < messages.length; i += 100) {
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(messages.slice(i, i + 100)),
      });
    }

    return reply({ ok: true, sent: messages.length });
  } catch (error) {
    console.error('cancel-activity failed', error);
    return reply({ error: 'Something went wrong.' }, 500);
  }
});