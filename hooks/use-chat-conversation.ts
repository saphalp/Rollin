import { useCallback, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useAuthContext } from '@/hooks/use-auth-context';
import { mergeMessages, type MessagePosition } from '@/lib/messaging';
import { loadChatInfo, loadMessagePage, markChatRead, sendChatMessage, subscribeToChats,
  type ChatInfo, type ChatMessage } from '@/services/messaging-service';

type State = { key: string; messages: ChatMessage[]; info: ChatInfo | null; loaded: boolean;
  refreshing: boolean; loadingOlder: boolean; hasOlder: boolean; sending: boolean; error: string; historyError: string; readError: string; sendError: string };
const initial = (key: string): State => ({ key, messages: [], info: null, loaded: false, refreshing: false,
  loadingOlder: false, hasOlder: true, sending: false, error: '', historyError: '', readError: '', sendError: '' });
const emptyActions = { refresh: async () => {}, older: async () => {}, read: async (_id: string) => {}, send: async (_text: string, _replyToId?: string | null) => false };

export function useChatConversation(id: string) {
  const { claims } = useAuthContext();
  const userId = typeof claims?.sub === 'string' ? claims.sub : null;
  const key = `${userId ?? ''}:${id}`;
  const [state, setState] = useState<State>(() => initial(key));
  const actions = useRef(emptyActions);

  useFocusEffect(useCallback(() => {
    if (!userId || !id) return;
    let disposed = false, foreground = AppState.currentState === 'active', queued = false;
    let rows: ChatMessage[] = [], info: ChatInfo | null = null, initialized = false;
    let running: Promise<void> | null = null, olderBusy = false, sendBusy = false, reading = false;
    let markedId: string | null = null;
    let pendingReadId: string | null = null;
    let syncCursor: MessagePosition | undefined;
    let debounce: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    const update = (patch: Partial<State>) => {
      if (!disposed) setState(previous => ({ ...(previous.key === key ? previous : initial(key)), ...patch }));
    };
    function refresh(): Promise<void> {
      if (disposed || !foreground) return Promise.resolve();
      if (running) { queued = true; return running; }
      running = (async () => {
        do {
          queued = false; update({ refreshing: true });
          try {
            const nextInfo = await loadChatInfo(id, userId!, controller.signal);
            let incoming: ChatMessage[] = [];
            if (!initialized || !syncCursor) {
              incoming = await loadMessagePage(id, controller.signal);
              if (!initialized) update({ hasOlder: incoming.length > 0 });
            } else {
              let cursor = syncCursor;
              // Catch up across every missed page after a disconnect, including >50 messages.
              for (;;) {
                const page = await loadMessagePage(id, controller.signal, cursor, true);
                if (!page.length) break;
                incoming.push(...page); cursor = page[page.length - 1];
              }
            }
            if (disposed) return;
            if (incoming.length) syncCursor = mergeMessages([], incoming).at(-1);
            info = nextInfo; rows = mergeMessages(rows, incoming); initialized = true;
            update({ info, messages: rows, loaded: true, error: '', refreshing: false });
          } catch (error) {
            update({ refreshing: false, error: error instanceof Error ? error.message : 'Could not refresh messages. Please retry.' });
          }
        } while (queued && !disposed && foreground);
      })().finally(() => { running = null; });
      return running;
    }
    async function older() {
      if (disposed || !foreground || olderBusy || !initialized || !rows.length) return;
      olderBusy = true; update({ loadingOlder: true });
      try {
        const page = await loadMessagePage(id, controller.signal, rows[0]);
        if (disposed) return;
        rows = mergeMessages(rows, page);
        update({ messages: rows, hasOlder: page.length > 0, historyError: '' });
      } catch (error) { update({ historyError: error instanceof Error ? error.message : 'Could not load older messages.' }); }
      finally { olderBusy = false; update({ loadingOlder: false }); }
    }
    async function read(messageId: string) {
      if (disposed || !foreground || markedId === messageId || !rows.some(row => row.id === messageId)) return;
      pendingReadId = messageId;
      if (reading) return;
      reading = true;
      try {
        while (pendingReadId && pendingReadId !== markedId && !disposed && foreground) {
          const observedId = pendingReadId;
          await markChatRead(id, observedId);
          if (!disposed) { markedId = observedId; update({ readError: '' }); }
        }
      } catch (error) { update({ readError: error instanceof Error ? error.message : 'Could not update read status.' }); }
      finally { reading = false; }
    }
    async function send(text: string, replyToId?: string | null) {
      if (disposed || !foreground || sendBusy || !initialized || info?.is_archived || !text.trim()) return false;
      sendBusy = true; update({ sending: true, sendError: '' });
      try {
        const sent = await sendChatMessage(id, userId!, text.trim(), replyToId);
        if (disposed) return false;
        rows = mergeMessages(rows, [sent]); update({ messages: rows });
        return true;
      } catch (error) { update({ sendError: error instanceof Error ? error.message : 'Message not sent. Try again.' }); return false; }
      finally { sendBusy = false; update({ sending: false }); }
    }
    actions.current = { refresh, older, read, send };
    void refresh();
    const unsubscribe = subscribeToChats(() => {
      clearTimeout(debounce); debounce = setTimeout(() => void refresh(), 150);
    }, id);
    const appState = AppState.addEventListener('change', next => { foreground = next === 'active'; if (foreground) void refresh(); });
    const interval = setInterval(() => void refresh(), 30000);
    return () => {
      disposed = true; controller.abort(); clearTimeout(debounce); clearInterval(interval);
      unsubscribe(); appState.remove(); actions.current = emptyActions;
    };
  }, [id, userId, key]));

  const current = state.key === key ? state : initial(key);
  return { ...current, userId, loading: !current.loaded && !current.error,
    refresh: () => actions.current.refresh(), loadOlder: () => actions.current.older(),
    markRead: (messageId: string) => actions.current.read(messageId), send: (text: string, replyToId?: string | null) => actions.current.send(text, replyToId) };
}
