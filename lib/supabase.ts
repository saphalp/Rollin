import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import "expo-sqlite/localStorage/install";
import "react-native-url-polyfill/auto";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabasePublishableKey =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error("Missing Supabase environment variables");
}

export const supabase = createClient(
  supabaseUrl,
  supabasePublishableKey,
  {
    auth: {
      storage: AsyncStorage,
      flowType: "pkce",
      detectSessionInUrl: false,
      autoRefreshToken: true,
      persistSession: true,
    },
  }
);

/**
 * Detects normal/transient WebSocket transport events (e.g. sleep/resume,
 * hot reload teardown, or server stream end close code 1001/1000/1006).
 * Supabase Realtime automatically reconnects on these events, so they should
 * not be logged as fatal application errors.
 */
export function isTransientRealtimeError(error: unknown): boolean {
  if (!error) return false;
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes('1001') ||
    message.includes('1000') ||
    message.includes('1006') ||
    message.includes('Stream end') ||
    message.includes('socket closed') ||
    message.includes('transport failure')
  );
}
