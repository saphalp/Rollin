import { useCallback, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useAuthContext } from '@/hooks/use-auth-context';
import type { CalendarPlan } from '@/lib/calendar-plans';
import { loadCalendarPlans, subscribeToCalendarPlans } from '@/services/calendar-plans-service';

type State = { userId: string | null; plans: CalendarPlan[]; loading: boolean; loaded: boolean; error: string; now: number };
const initialState = (): State => ({ userId: null, plans: [], loading: true, loaded: false, error: '', now: Date.now() });

export function useCalendarPlans() {
  const { claims } = useAuthContext();
  const userId = typeof claims?.sub === 'string' ? claims.sub : null;
  const [state, setState] = useState<State>(initialState);
  const refreshRef = useRef<() => void>(() => {});

  useFocusEffect(useCallback(() => {
    if (!userId) return;
    let disposed = false;
    let loading = false;
    let queued = false;
    let foreground = AppState.currentState !== 'background' && AppState.currentState !== 'inactive';
    let debounce: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();

    async function refresh() {
      if (disposed || !foreground) return;
      if (loading) { queued = true; return; }
      loading = true;
      setState(previous => ({ ...(previous.userId === userId ? previous : initialState()), userId, loading: true, error: '', now: Date.now() }));
      try {
        const plans = await loadCalendarPlans(userId!, controller.signal);
        if (!disposed) setState({ userId, plans, loading: false, loaded: true, error: '', now: Date.now() });
      } catch (error) {
        if (!disposed) setState(previous => ({ ...previous, loading: false,
          error: error instanceof Error ? error.message : 'Could not refresh your calendar. Please try again.' }));
      } finally {
        loading = false;
        if (queued && !disposed) { queued = false; void refresh(); }
      }
    }

    function scheduleRefresh() {
      clearTimeout(debounce);
      debounce = setTimeout(() => { void refresh(); }, 300);
    }

    refreshRef.current = () => { void refresh(); };
    void refresh();
    const unsubscribe = subscribeToCalendarPlans(scheduleRefresh);
    const appState = AppState.addEventListener('change', next => {
      foreground = next === 'active';
      if (foreground) void refresh();
    });
    // Also covers projects without Realtime publications and missed DELETEs.
    const interval = setInterval(() => { void refresh(); }, 60000);
    return () => {
      disposed = true;
      controller.abort();
      clearTimeout(debounce);
      clearInterval(interval);
      appState.remove();
      unsubscribe();
      refreshRef.current = () => {};
    };
  }, [userId]));

  const current = state.userId === userId ? state : initialState();
  return { ...current, userId, refresh: () => refreshRef.current() };
}
