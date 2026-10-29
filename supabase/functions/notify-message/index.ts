import { createClient } from 'npm:@supabase/supabase-js@2.110.2';
import { requireVerifiedLogin } from '../_shared/login-verification.ts';

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
      {
        global: { headers: { Authorization: authorization } },
        auth: { persistSession: false, autoRefreshToken: false }
      },
    );
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) return reply({ error: 'Sign in again.' }, 401);
    if (!(await requireVerifiedLogin(client))) return reply({ error: 'Complete email login verification first.' }, 403);

    const body = await req.json().catch(() => null);
    if (typeof body?.messageId !== 'string' ||
      !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(body.messageId)) {
      return reply({ error: 'A valid message ID is required.' }, 400);
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    // 1. Load the message and make sure the caller sent it.
    const { data: message } = await admin
      .from('messages')
      .select('id, conversation_id, sender_id, content, type')
      .eq('id', body.messageId)
      .single();
    if (!message || message.sender_id !== user.id) {
      return reply({ error: 'Message not found.' }, 404);
    }

    // 2. Everyone else in the chat.
    const { data: participants } = await admin
      .from('conversation_participants')
      .select('user_id')
      .eq('conversation_id', message.conversation_id);
    let recipients = (participants ?? [])
      .map((p) => p.user_id)
      .filter((id) => id !== user.id);
    if (recipients.length === 0) return reply({ ok: true, sent: 0 });

    // 3. Skip anyone who muted this chat.
    const { data: muted } = await admin
      .from('muted_conversations')
      .select('user_id')
      .eq('conversation_id', message.conversation_id)
      .in('user_id', recipients);
    const mutedIds = new Set((muted ?? []).map((m) => m.user_id));

    // 4. Skip anyone who turned off chat notifications.
    const { data: settings } = await admin
      .from('notification_settings')
      .select('user_id, chat_messages')
      .in('user_id', recipients);
    const offIds = new Set((settings ?? []).filter((s) => !s.chat_messages).map((s) => s.user_id));

    recipients = recipients.filter((id) => !mutedIds.has(id) && !offIds.has(id));
    if (recipients.length === 0) return reply({ ok: true, sent: 0, skippedMuted: mutedIds.size, skippedOff: offIds.size });

    // 5. Send the push.
    const { data: sender } = await admin
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single();

    const { data: tokens } = await admin
      .from('push_tokens')
      .select('expo_push_token')
      .in('profile_id', recipients);

    const pushTokens = [...new Set((tokens ?? []).map((t) => t.expo_push_token))];
    // Shared activities/posts may have null message content.
    const fallback = message.type === 'shared_activity' || message.type === 'activity'
      ? 'Shared an activity'
      : message.type === 'shared_post' || message.type === 'post'
        ? 'Shared a post'
        : 'Sent you a message';
    const content = typeof message.content === 'string' && message.content.trim()
      ? message.content
      : fallback;
    const preview = content.length > 120 ? content.slice(0, 117) + '...' : content;
    const messages = pushTokens.map((to) => ({
      to,
      title: sender?.full_name ?? 'New message',
      body: preview,
      sound: 'default',
      data: { type: 'chat_message', conversationId: message.conversation_id },
    }));

    for (let i = 0; i < messages.length; i += 100) {
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(messages.slice(i, i + 100)),
      });
    }

    console.log('notify-message', { sent: messages.length, skippedMuted: mutedIds.size, skippedOff: offIds.size });
    return reply({ ok: true, sent: messages.length, skipped: mutedIds.size + offIds.size });
  } catch (error) {
    console.error('notify-message failed', error);
    return reply({ error: 'Something went wrong.' }, 500);
  }
});