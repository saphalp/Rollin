import Constants from 'expo-constants';
import { AppState, Platform, type AppStateStatus } from 'react-native';

import { supabase } from '@/lib/supabase';

// Usage events for the admin dashboard's Frontend / UX page (`public.app_events`).
// RLS allows signed-in users to insert their own rows only, and nothing here can read
// them back. Everything is fire-and-forget: tracking never throws or blocks the UI.

export type AppEventType = 'screen_view' | 'session_start' | 'session_end' | 'error';
type Metadata = Record<string, string | number | boolean | null>;

const appVersion = Constants.expoConfig?.version ?? null;
let currentScreen: string | null = null;
let sessionStartedAt: number | null = null;
// False when the launch's session_start was skipped because nobody was signed in yet.
let sessionStartRecorded = false;
let lastError: { key: string; at: number } | null = null;

function warn(message: string, detail?: unknown) {
  if (__DEV__) console.warn(`[analytics] ${message}`, detail ?? '');
}

async function insert(eventType: AppEventType, screen: string | null, metadata: Metadata | null): Promise<boolean> {
  // getSession reads the stored session without a network call. Signed-out users can't
  // insert (the policy is for `authenticated` only), so they're skipped.
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user.id;
  if (!userId) return false;
  const { error } = await supabase.from('app_events').insert({
    user_id: userId, event_type: eventType, screen, platform: Platform.OS, app_version: appVersion, metadata,
  });
  if (error) warn(`insert ${eventType} failed`, error.message);
  return !error;
}

/** Record one event. Never throws and never waits; failures are ignored. */
export function track(eventType: AppEventType,
  options: { screen?: string | null; metadata?: Metadata; onRecorded?: () => void } = {}) {
  try {
    void insert(eventType, options.screen ?? currentScreen, options.metadata ?? null)
      .then(recorded => { if (recorded) options.onRecorded?.(); })
      .catch(error => warn(`track ${eventType} failed`, error));
  } catch (error) {
    warn(`track ${eventType} failed`, error);
  }
}

/**
 * Turns a route into a pattern that groups screens without leaking ids, from
 * expo-router's segments: ['(tabs)', 'explore'] -> '/explore', ['activity', '[id]'] -> '/activity/[id]'.
 */
export function routePattern(segments: readonly string[]): string {
  return `/${segments.filter(segment => !/^\(.*\)$/.test(segment) && segment !== 'index').join('/')}`;
}

/** Logs a screen_view for a route change. Repeats of the same path are dropped by the caller. */
export function trackScreen(screen: string) {
  currentScreen = screen;
  track('screen_view', { screen });
}

export function trackError(error: unknown, source: 'boundary' | 'global', fatal?: boolean) {
  const err = error instanceof Error ? error : new Error(String(error));
  const key = `${err.name}:${err.message}`;
  const now = Date.now();
  // A render loop can throw the same error many times in a row; record it once.
  if (lastError?.key === key && now - lastError.at < 10_000) return;
  lastError = { key, at: now };
  const metadata: Metadata = { message: err.message.slice(0, 500), name: err.name, source };
  if (fatal !== undefined) metadata.fatal = fatal;
  const stack = err.stack?.split('\n').slice(0, 5).join('\n');
  if (stack && stack.length <= 1000) metadata.stack = stack;
  track('error', { metadata });
}

function startSession() {
  sessionStartedAt = Date.now();
  sessionStartRecorded = false;
  track('session_start', { onRecorded: () => { sessionStartRecorded = true; } });
}

function onAppState(next: AppStateStatus) {
  if (next === 'active' && sessionStartedAt === null) {
    startSession();
  } else if (next === 'background' && sessionStartedAt !== null) {
    track('session_end', { metadata: { duration_ms: Date.now() - sessionStartedAt } });
    sessionStartedAt = null;
  }
}

/**
 * Starts session tracking and catches errors nothing else handled. Call once at the app
 * root; returns a cleanup. The previous global error handler still runs afterwards, so
 * the development error overlay and crash reporting behave as before.
 */
export function startAppTracking() {
  onAppState(AppState.currentState === 'background' ? 'background' : 'active');
  const subscription = AppState.addEventListener('change', onAppState);
  // Opened signed out, then signed in: start the session now so it has a matching start.
  const { data: auth } = supabase.auth.onAuthStateChange(event => {
    // Deferred: calling Supabase inside this callback can deadlock the auth client.
    if (event === 'SIGNED_IN' && sessionStartedAt !== null && !sessionStartRecorded) setTimeout(startSession, 0);
  });

  const errorUtils = (globalThis as { ErrorUtils?: {
    getGlobalHandler(): (error: unknown, isFatal?: boolean) => void;
    setGlobalHandler(handler: (error: unknown, isFatal?: boolean) => void): void;
  } }).ErrorUtils;
  const previous = errorUtils?.getGlobalHandler();
  errorUtils?.setGlobalHandler((error, isFatal) => {
    trackError(error, 'global', !!isFatal);
    previous?.(error, isFatal);
  });

  return () => {
    subscription.remove();
    auth.subscription.unsubscribe();
    if (previous) errorUtils?.setGlobalHandler(previous);
  };
}
