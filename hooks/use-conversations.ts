import { useCallback, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useAuthContext } from '@/hooks/use-auth-context';
import { conversationTime } from '@/lib/messaging';
import { hideConversation, loadConversations, subscribeToChats, type ConversationSummary } from '@/services/messaging-service';
export type { ConversationSummary } from '@/services/messaging-service';

type State = { userId: string | null; rows: ConversationSummary[]; loaded: boolean; refreshing: boolean; error: string };
const initial = (): State => ({ userId: null, rows: [], loaded: false, refreshing: false, error: '' });
export function useConversations() {
  const { claims } = useAuthContext();
  const userId = typeof claims?.sub === 'string' ? claims.sub : null;
  const [state, setState] = useState<State>(initial);
  const refreshRef = useRef<() => Promise<void>>(async () => {});

  useFocusEffect(useCallback(() => {
    if (!userId) return;
    let disposed = false, foreground = AppState.currentState === 'active', queued = false;
    let running: Promise<void> | null = null;
    let debounce: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    function refresh(): Promise<void> {
      if (disposed || !foreground) return Promise.resolve();
      if (running) { queued = true; return running; }
      running = (async () => {
        do {
          queued = false;
          setState(previous => ({ ...(previous.userId === userId ? previous : initial()), userId, refreshing: true }));
          try {
            const rows = await loadConversations(controller.signal);
            if (!disposed) setState({ userId, rows, loaded: true, refreshing: false, error: '' });
          } catch {
            if (!disposed) setState(previous => ({ ...previous, refreshing: false, error: 'Could not refresh conversations. Check your connection and retry.' }));
          }
        } while (queued && !disposed && foreground);
      })().finally(() => { running = null; });
      return running;
    }
    refreshRef.current = refresh;
    void refresh();
    const unsubscribe = subscribeToChats(() => {
      clearTimeout(debounce); debounce = setTimeout(() => void refresh(), 150);
    });
    const appState = AppState.addEventListener('change', next => { foreground = next === 'active'; if (foreground) void refresh(); });
    // Refresh timestamps and recover missed changes/deletes after reconnecting.
    const interval = setInterval(() => void refresh(), 30000);
    return () => { disposed = true; controller.abort(); clearTimeout(debounce); clearInterval(interval); unsubscribe(); appState.remove(); refreshRef.current = async () => {}; };
  }, [userId]));

  async function deleteConversation(id: string) {
    if (!userId) throw new Error('Sign in again to delete a conversation.');
    await hideConversation(id, userId);
    setState(previous => previous.userId === userId ? { ...previous, rows: previous.rows.filter(row => row.id !== id) } : previous);
    await refreshRef.current();
  }
  const current = state.userId === userId ? state : initial();
  const activeConversations = current.rows.filter(row => !row.isArchived);
  return { conversations: activeConversations, activeConversations,
    archivedConversations: current.rows.filter(row => row.isArchived),
    loading: !!userId && !current.loaded && !current.error,
    refreshing: current.refreshing, error: current.error, refresh: () => refreshRef.current(),
    formatTime: conversationTime, deleteConversation };
}
