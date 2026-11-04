
import { supabase } from "@/lib/supabase";
import { usePathname } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { useAuthContext } from "./use-auth-context";

const readListeners = new Set<() => void>();

// Unique channel ID for each subscription instance.
let unreadChannelCounter = 0;

export function notifyNotificationsRead() {
  readListeners.forEach((listener) => listener());
}

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

    if (request !== generation.current) return;

    if (error) {
      console.error(
        "[notifications] unread count failed:",
        error
      );
      return;
    }

    setHasUnread((count ?? 0) > 0);
  }, [currentUserId]);

  // Refresh on navigation.
  useEffect(() => {
    void refresh();

    return () => {
      generation.current++;
    };
  }, [refresh, pathname]);

  // Refresh when notifications are marked as read.
  useEffect(() => {
    const listener = () => void refresh();

    readListeners.add(listener);

    return () => {
      readListeners.delete(listener);
    };
  }, [refresh]);

  // Refresh when the app returns to foreground.
  useEffect(() => {
    const subscription = AppState.addEventListener(
      "change",
      (state) => {
        if (state === "active") {
          void refresh();
        }
      }
    );

    return () => subscription.remove();
  }, [refresh]);

  // Supabase Realtime subscription.
  useEffect(() => {
    if (!currentUserId) {
      return;
    }

    unreadChannelCounter++;

    const channelName =
      `notifications-unread-${currentUserId}-${unreadChannelCounter}`;

    const channel = supabase.channel(channelName);

    // Register callbacks BEFORE subscribing.
    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "notifications",
        filter: `user_id=eq.${currentUserId}`,
      },
      () => {
        void refresh();
      }
    );

    channel.subscribe((status, error) => {
      if (
        status === "CHANNEL_ERROR" ||
        status === "TIMED_OUT"
      ) {
        console.error(
          "[notifications] realtime error:",
          status,
          error
        );
      }
    });

    // Remove this specific channel on unmount.
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [currentUserId, refresh]);

  return Boolean(currentUserId && hasUnread);
}
