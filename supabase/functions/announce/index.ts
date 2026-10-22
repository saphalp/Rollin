import { requireVerifiedLogin } from '../_shared/login-verification.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.110.2';

function haversineDistanceMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

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
      return reply({ error: 'Sign in to post an announcement.' }, 401);
    }
    const client = createClient(
      Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authorization } },
        auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) return reply({ error: 'Sign in again to post an announcement.' }, 401);
    if (!(await requireVerifiedLogin(client))) return reply({ error: 'Complete email login verification first.' }, 403);

    const body = await req.json().catch(() => null);
    if (typeof body?.announcementId !== 'string' ||
        !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(body.announcementId)) {
      return reply({ error: 'A valid announcement ID is required.' }, 400);
    }
    const announcementId = body.announcementId;

    const { data: announcement, error: loadError } = await client
      .from('announcements')
      .select('id, body, activity_id, activity:activities(title, host_id, latitude, longitude)')
      .eq('id', announcementId)
      .single();
    if (loadError || !announcement) {
      return reply({ error: 'Announcement not found.' }, 404);
    }
    if (announcement.activity?.host_id !== user.id) {
      return reply({ error: 'Only the activity host can send announcements.' }, 403);
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    const { data: members, error: membersError } = await admin
      .from('rsvps')
      .select('user_id')
      .eq('activity_id', announcement.activity_id);
    if (membersError) return reply({ error: 'Could not load members.' }, 500);

    const memberIds = (members ?? [])
      .map((m) => m.user_id)
      .filter((id) => id !== user.id);
    if (memberIds.length === 0) return reply({ ok: true, sent: 0 });

    const actLat = (announcement.activity as any)?.latitude as number | null ?? null;
    const actLng = (announcement.activity as any)?.longitude as number | null ?? null;

    let filteredIds = memberIds;
    if (actLat != null && actLng != null) {
      const { data: notifSettings } = await admin
        .from('notification_settings')
        .select('user_id, nearby_activities_enabled, nearby_activities_radius_miles, user_latitude, user_longitude')
        .in('user_id', memberIds);

      const settingsMap = new Map((notifSettings ?? []).map((s: any) => [s.user_id, s]));

      filteredIds = memberIds.filter((id) => {
        const s = settingsMap.get(id) as any;
        if (!s?.nearby_activities_enabled) return true;
        if (s.user_latitude == null || s.user_longitude == null) return true;
        return haversineDistanceMiles(s.user_latitude, s.user_longitude, actLat, actLng) <= (s.nearby_activities_radius_miles ?? 5);
      });
    }

    const { data: tokens, error: tokensError } = await admin
      .from('push_tokens')
      .select('expo_push_token')
      .in('profile_id', filteredIds);
    if (tokensError) return reply({ error: 'Could not load push tokens.' }, 500);

        const pushTokens = [...new Set((tokens ?? []).map((t) => t.expo_push_token))];
    const messages = pushTokens.map((to) => ({
      to,
      title: announcement.activity?.title ?? 'New announcement',
      body: announcement.body,
      sound: 'default',
      data: { type: 'announcement', activityId: announcement.activity_id, announcementId },
    }));

    for (let i = 0; i < messages.length; i += 100) {
      const res = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(messages.slice(i, i + 100)),
      });
      if (!res.ok) return reply({ error: 'Could not send notifications.' }, 502);
    }

    return reply({ ok: true, sent: messages.length });
  } catch (error) {
    return reply({ error: 'Something went wrong.' }, 500);
  }
});