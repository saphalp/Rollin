import { supabase } from "@/lib/supabase";
import { usePathname } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { useAuthContext } from "./use-auth-context";

const readListeners = new Set<() => void>();

/** Tells every useUnreadNotifications instance to recheck, e.g. right after marking rows read. */
export function notifyNotificationsRead() {
  readListeners.forEach((listener) => listener());
}

/**
 * Whether the signed-in user has any unread notifications. Kept live by realtime
 * inserts/updates on their notifications, and rechecked on navigation and app
 * foreground — realtime doesn't deliver filtered DELETE events, so a deleted unread
 * notification is only noticed by a recheck.
 */
export function useUnreadNotifications(): boolean {
  const { claims } = useAuthContext();
  const currentUserId = claims?.sub as string | undefined;
  const pathname = usePathname();
  const [hasUnread, setHasUnread] = useState(false);
  const generation = useRef(0);

  const refresh = useCallback(async () => {
    if (!currentUserId) return;
    const request = ++generation.current;
    const { count, error } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", currentUserId)
      .eq("is_read", false);
    // Ignore stale responses so an older count can't overwrite a newer one.
    if (request !== generation.current) return;
    if (error) {
      console.error("[notifications] unread count failed:", error);
      return;
    }
    setHasUnread((count ?? 0) > 0);
  }, [currentUserId]);

  useEffect(() => {
    // State is only set after the awaited count query, not synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh, pathname]);

  useEffect(() => {
    const listener = () => void refresh();
    readListeners.add(listener);
    return () => {
      readListeners.delete(listener);
    };
  }, [refresh]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void refresh();
    });
    return () => subscription.remove();
  }, [refresh]);

  useEffect(() => {
    if (!currentUserId) return;

    const channel = supabase
      .channel(`notifications-unread-${currentUserId}-${Date.now()}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${currentUserId}`,
        },
        () => {
          void refresh();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, refresh]);

  return !!currentUserId && hasUnread;
}
