import { supabase } from '@/lib/supabase';
import { resolveAvatarUri } from '@/lib/profile/resolve-avatar-uri';
import { conversationPreview, type MessagePosition, type ReadPosition } from '@/lib/messaging';

export type ConversationSummary = {
  id: string; type: 'direct' | 'group'; title: string; avatarUri: string;
  lastMessage: string; lastMessageAt: string; otherUserId?: string; activityId?: string;
  isArchived: boolean; unreadCount: number;
};
export type ChatMessage = MessagePosition & {
  conversation_id: string; sender_id: string; content: string | null;
  type: 'text' | 'activity' | 'post'; shared_activity_id: string | null; shared_post_id: string | null;
  reply_to_message_id?: string | null; deleted_for_everyone?: boolean;
  senderName?: string; senderAvatar?: string;
  sharedActivity?: { id: string; title: string; hostName: string; imageUrl: string };
  sharedPost?: { id: string; activityId: string; posterName: string; caption: string | null; imageUrl: string };
};
export type ChatInfo = {
  type: 'direct' | 'group'; activity_id: string | null; is_archived: boolean;
  otherUserId?: string; receipts: ReadPosition[];
  // Resolved here so a chat opened from a notification or deep link still has a header.
  title?: string; avatarUri?: string;
};
const MESSAGE_FIELDS = 'id, conversation_id, sender_id, content, type, shared_activity_id, shared_post_id, reply_to_message_id, deleted_for_everyone, created_at';
const listeners = new Set<() => void>();
export function notifyChatChanged() { listeners.forEach(listener => listener()); }

export function subscribeToChats(onChange: () => void, conversationId?: string) {
  listeners.add(onChange);
  const channel = supabase.channel(`chats-${conversationId ?? 'list'}-${Math.random().toString(36).slice(2)}`);
  for (const table of ['messages', 'conversations', 'conversation_participants', 'deleted_conversations', 'conversation_read_state']) {
    const filter = conversationId && table !== 'conversations' ? `conversation_id=eq.${conversationId}` : undefined;
    channel.on('postgres_changes', { event: '*', schema: 'public', table, ...(filter ? { filter } : {}) }, onChange);
  }
  channel.subscribe(status => { if (status === 'SUBSCRIBED') onChange(); });
  return () => { listeners.delete(onChange); void supabase.removeChannel(channel); };
}

export async function loadConversations(signal: AbortSignal): Promise<ConversationSummary[]> {
  const rows: any[] = [];
  // Stable ID paging, then sort by latest message after all rows have arrived.
  for (let offset = 0; ;) {
    const { data, error } = await supabase.rpc('get_conversation_summaries').order('id').range(offset, offset + 99).abortSignal(signal);
    if (error) throw new Error('Could not load conversations. Please try again.');
    if (!data?.length) break;
    rows.push(...data); offset += data.length;
  }
  return rows.map(row => ({
    id: row.id, type: row.type, title: row.title,
    avatarUri: row.type === 'direct' ? resolveAvatarUri(row.avatar_path)
      : row.avatar_path || `https://picsum.photos/seed/${row.category || 'social'}/240/240`,
    lastMessage: conversationPreview(row.last_message, row.last_message_type, row.type === 'group'),
    lastMessageAt: row.last_message_at, otherUserId: row.other_user_id ?? undefined,
    activityId: row.activity_id ?? undefined, isArchived: row.type === 'group' && !!row.is_archived,
    unreadCount: Number(row.unread_count),
  })).sort((a, b) => Date.parse(b.lastMessageAt) - Date.parse(a.lastMessageAt) || a.id.localeCompare(b.id));
}

export async function hideConversation(conversationId: string, userId: string) {
  // Refresh deleted_at on every delete: the chat reappears only for messages sent after it.
  const { error } = await supabase.from('deleted_conversations').upsert(
    { conversation_id: conversationId, user_id: userId, deleted_at: new Date().toISOString() }, { onConflict: 'user_id,conversation_id' });
  if (error) throw new Error('Could not delete this conversation. Please try again.');
  notifyChatChanged();
}

export async function loadChatInfo(id: string, userId: string, signal: AbortSignal): Promise<ChatInfo> {
  const { data, error } = await supabase.from('conversations').select('type, activity_id, is_archived').eq('id', id).abortSignal(signal).single();
  if (error || !data) throw new Error('This conversation could not be loaded. Check your connection and try again.');
  const { data: membership, error: memberError } = await supabase.from('conversation_participants')
    .select('user_id').eq('conversation_id', id).eq('user_id', userId).abortSignal(signal).maybeSingle();
  if (memberError || !membership) throw new Error('You no longer have access to this conversation.');
  const { data: receipts, error: readError } = await supabase.from('conversation_read_state')
    .select('user_id, last_read_at, last_read_message_id').eq('conversation_id', id).abortSignal(signal);
  if (readError) throw new Error('Could not load message read status. Please try again.');
  let otherUserId: string | undefined;
  if (data.type === 'direct') {
    const { data: other, error: otherError } = await supabase.from('conversation_participants').select('user_id')
      .eq('conversation_id', id).neq('user_id', userId).abortSignal(signal).maybeSingle();
    if (otherError) throw new Error('Could not load conversation participants. Please try again.');
    otherUserId = other?.user_id;
  }
  let title: string | undefined, avatarUri: string | undefined;
  if (otherUserId) {
    const { data: profile } = await supabase.from('profiles').select('full_name, profile_picture')
      .eq('id', otherUserId).abortSignal(signal).maybeSingle();
    title = profile?.full_name?.trim() || "Rollin' User"; avatarUri = resolveAvatarUri(profile?.profile_picture);
  } else if (data.activity_id) {
    const { data: activity } = await supabase.from('activities').select('title, image_url, category')
      .eq('id', data.activity_id).abortSignal(signal).maybeSingle();
    title = activity?.title?.trim() || 'Activity chat';
    avatarUri = activity?.image_url || `https://picsum.photos/seed/${activity?.category || 'social'}/240/240`;
  }
  return { ...data, otherUserId, receipts: receipts ?? [], title, avatarUri };
}

export async function loadMessagePage(id: string, signal: AbortSignal, cursor?: MessagePosition, newer = false): Promise<ChatMessage[]> {
  const { data, error } = await supabase.rpc('get_chat_messages', {
    p_conversation_id: id, p_cursor_at: cursor?.created_at ?? null,
    p_cursor_id: cursor?.id ?? null, p_newer: newer,
  }).abortSignal(signal);
  if (error) throw new Error('Could not load messages. Please try again.');
  return hydrateMessages(data ?? [], signal);
}

async function hydrateMessages(rows: ChatMessage[], signal: AbortSignal): Promise<ChatMessage[]> {
  if (!rows.length) return [];
  async function lookup(table: string, fields: string, ids: string[]) {
    if (!ids.length) return [];
    const { data, error } = await supabase.from(table).select(fields).in('id', [...new Set(ids)]).abortSignal(signal);
    if (error) throw new Error('Could not load message details. Please try again.');
    return (data ?? []) as unknown as Record<string, any>[];
  }
  const photos = await lookup('activity_photos', 'id, activity_id, user_id, image_path, caption', rows.flatMap(m => m.shared_post_id ? [m.shared_post_id] : []));
  const activities = await lookup('activities', 'id, title, image_url, category, host_id', [
    ...rows.flatMap(m => m.shared_activity_id ? [m.shared_activity_id] : []), ...photos.map(p => p.activity_id),
  ]);
  const profiles = await lookup('profiles', 'id, full_name, profile_picture', [...rows.map(m => m.sender_id), ...photos.map(p => p.user_id), ...activities.map(a => a.host_id)]);
  const names = new Map(profiles.map(p => [p.id, p.full_name || "Rollin' User"]));
  const avatars = new Map(profiles.map(p => [p.id, resolveAvatarUri(p.profile_picture)]));
  return rows.map(row => {
    const activity = activities.find(a => a.id === row.shared_activity_id);
    const photo = photos.find(p => p.id === row.shared_post_id);
    return { ...row, senderName: names.get(row.sender_id) || "Rollin' User", senderAvatar: avatars.get(row.sender_id),
      sharedActivity: row.shared_activity_id && activity ? {
        id: activity.id, title: activity.title, hostName: names.get(activity.host_id) || "Rollin' User",
        imageUrl: activity.image_url || `https://picsum.photos/seed/${activity.category || 'activity'}/240/240`,
      } : undefined,
      sharedPost: row.shared_post_id && photo ? {
        id: photo.id, activityId: photo.activity_id, posterName: names.get(photo.user_id) || "Rollin' User",
        caption: photo.caption, imageUrl: supabase.storage.from('activity-photos').getPublicUrl(photo.image_path).data.publicUrl,
      } : undefined,
    };
  });
}

export async function markChatRead(conversationId: string, messageId: string) {
  const { error } = await supabase.rpc('mark_conversation_read', { p_conversation_id: conversationId, p_message_id: messageId });
  if (error) throw new Error('Could not update read status. Tap retry.');
  notifyChatChanged();
}

export async function sendChatMessage(conversationId: string, userId: string, content: string,
  replyToMessageId?: string | null): Promise<ChatMessage> {
  const { data, error } = await supabase.from('messages').insert({ conversation_id: conversationId, sender_id: userId, content,
    ...(replyToMessageId ? { reply_to_message_id: replyToMessageId } : {}) }).select(MESSAGE_FIELDS).single();
  if (error || !data) throw new Error('Message not sent. Your text is still here—try again.');
  notifyChatChanged();
  // The persisted message succeeds independently of push-notification delivery.
  void supabase.functions.invoke('notify-message', { body: { messageId: data.id } }).catch(() => {});
  return data as ChatMessage;
}
