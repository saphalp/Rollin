import { supabase } from '@/lib/supabase';

export type Reaction = { message_id: string; user_id: string; emoji: string };
export type ChatActionsState = { pinnedId: string | null; hiddenIds: string[] };

export async function loadPinAndHidden(conversationId: string, userId: string): Promise<ChatActionsState> {
  const [pins, hidden] = await Promise.all([
    supabase.from('conversation_pins').select('message_id').eq('conversation_id', conversationId).maybeSingle(),
    supabase.from('hidden_chat_messages').select('message_id').eq('conversation_id', conversationId).eq('user_id', userId),
  ]);
  if (pins.error || hidden.error) throw new Error('Could not load pinned and deleted messages.');
  return { pinnedId: pins.data?.message_id ?? null, hiddenIds: (hidden.data ?? []).map(row => row.message_id) };
}

export async function setPinnedMessage(conversationId: string, messageId: string | null) {
  const { error } = messageId
    ? await supabase.rpc('pin_chat_message', { p_message_id: messageId })
    : await supabase.rpc('unpin_chat_message', { p_conversation_id: conversationId });
  if (error) throw new Error('Could not change the pinned message. Please try again.');
}

export async function deleteChatMessage(messageId: string, forEveryone: boolean) {
  const { error } = await supabase.rpc('delete_chat_message', { p_message_id: messageId, p_for_everyone: forEveryone });
  if (error) throw new Error('Could not delete this message. Please try again.');
}

export async function loadReactions(messageIds: string[]): Promise<Reaction[]> {
  if (!messageIds.length) return [];
  const { data, error } = await supabase.from('message_reactions').select('message_id, user_id, emoji').in('message_id', messageIds);
  if (error) throw new Error('Could not load reactions.');
  return data ?? [];
}

/** One reaction per person per message: the same emoji again removes it, a different one replaces it. */
export async function toggleReaction(messageId: string, userId: string, emoji: string, current?: string) {
  const { error } = current === emoji
    ? await supabase.from('message_reactions').delete().eq('message_id', messageId).eq('user_id', userId)
    : await supabase.from('message_reactions').upsert({ message_id: messageId, user_id: userId, emoji }, { onConflict: 'message_id,user_id' });
  if (error) throw new Error('Could not update your reaction. Please try again.');
}

/** Pins, this user's hidden messages, reactions, and delete-for-everyone edits for one chat. */
export function subscribeToChatActions(conversationId: string, userId: string, handlers: {
  onPinsOrHidden: () => void; onReactions: () => void; onMessageDeleted: (messageId: string) => void;
}) {
  const channel = supabase.channel(`chat-actions-${conversationId}-${Math.random().toString(36).slice(2)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'conversation_pins', filter: `conversation_id=eq.${conversationId}` }, handlers.onPinsOrHidden)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'hidden_chat_messages', filter: `user_id=eq.${userId}` }, handlers.onPinsOrHidden)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'message_reactions' }, handlers.onReactions)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
      payload => { if ((payload.new as { deleted_for_everyone?: boolean }).deleted_for_everyone) handlers.onMessageDeleted((payload.new as { id: string }).id); })
    .subscribe();
  return () => { void supabase.removeChannel(channel); };
}
