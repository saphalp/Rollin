import { useCallback, useEffect, useRef, useState } from 'react';
import { deleteChatMessage, loadPinAndHidden, loadReactions, setPinnedMessage, subscribeToChatActions,
  toggleReaction, type Reaction } from '@/services/chat-actions-service';

/**
 * Per-message actions layered on top of useChatConversation: pin, react, and delete for
 * me or everyone. Messages loaded by the conversation hook are passed in by id.
 */
export function useChatActions(conversationId: string, userId: string | null, messageIds: string[]) {
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(() => new Set());
  const [deletedIds, setDeletedIds] = useState<Set<string>>(() => new Set());
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [busy, setBusy] = useState(false);
  const messageIdsRef = useRef(messageIds);
  const idsKey = messageIds.join(',');
  useEffect(() => { messageIdsRef.current = messageIds; });

  const refreshPinAndHidden = useCallback(async () => {
    if (!userId) return;
    try {
      const next = await loadPinAndHidden(conversationId, userId);
      setPinnedId(next.pinnedId); setHiddenIds(new Set(next.hiddenIds));
    } catch (error) { console.warn('[chat] pins/hidden:', error); }
  }, [conversationId, userId]);

  const refreshReactions = useCallback(async () => {
    try { setReactions(await loadReactions(messageIdsRef.current)); }
    catch (error) { console.warn('[chat] reactions:', error); }
  }, []);

  useEffect(() => { void refreshPinAndHidden(); }, [refreshPinAndHidden]);
  // Reload reactions whenever the set of loaded messages changes (new, older page, etc).
  useEffect(() => { void refreshReactions(); }, [idsKey, refreshReactions]);

  useEffect(() => {
    if (!userId) return;
    return subscribeToChatActions(conversationId, userId, {
      onPinsOrHidden: () => void refreshPinAndHidden(),
      onReactions: () => void refreshReactions(),
      onMessageDeleted: messageId => setDeletedIds(previous => new Set(previous).add(messageId)),
    });
  }, [conversationId, userId, refreshPinAndHidden, refreshReactions]);

  async function run(work: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    try { await work(); } finally { setBusy(false); }
  }

  return {
    pinnedId, hiddenIds, deletedIds, reactions, busy,
    togglePin: (messageId: string) => run(async () => {
      const next = pinnedId === messageId ? null : messageId;
      await setPinnedMessage(conversationId, next);
      setPinnedId(next);
    }),
    deleteMessage: (messageId: string, forEveryone: boolean) => run(async () => {
      await deleteChatMessage(messageId, forEveryone);
      if (forEveryone) setDeletedIds(previous => new Set(previous).add(messageId));
      else setHiddenIds(previous => new Set(previous).add(messageId));
      if (pinnedId === messageId) setPinnedId(null);
    }),
    react: async (messageId: string, emoji: string) => {
      if (!userId) return;
      const mine = reactions.find(r => r.message_id === messageId && r.user_id === userId)?.emoji;
      await toggleReaction(messageId, userId, emoji, mine);
      await refreshReactions();
    },
  };
}
