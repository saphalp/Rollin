
import { supabase } from "@/lib/supabase";
import { useEffect, useRef } from "react";
import { useAuthContext } from "./use-auth-context";

export type NotificationPayload = {
  id: string;
  user_id: string;
  actor_id: string | null;
  type: string | null;
  message: string;
  is_read: boolean | null;
  created_at: string | null;
};

// Give every subscription instance a unique channel name.
let notificationChannelCounter = 0;

export function useNotificationRealtime(
  onInsert: (n: NotificationPayload) => void
) {
  const { claims } = useAuthContext();
  const currentUserId = claims?.sub as string | undefined;

  // Always call the latest callback without recreating subscriptions.
  const callbackRef = useRef(onInsert);

  useEffect(() => {
    callbackRef.current = onInsert;
  }, [onInsert]);

  // Track recently received notification IDs.
  const seenIds = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    if (!currentUserId) {
      return;
    }

    // Create a unique channel for this effect instance.
    const channelId = ++notificationChannelCounter;

    const channel = supabase.channel(
      `notifications-realtime-${currentUserId}-${channelId}`
    );

    // Register event callbacks before subscribing.
    channel.on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "notifications",
        filter: `user_id=eq.${currentUserId}`,
      },
      (payload) => {
        const item = payload.new as NotificationPayload;

        if (!item?.id) {
          return;
        }

        const now = Date.now();
        const lastSeen = seenIds.current.get(item.id);

        // Ignore repeated events for the same notification.
        if (lastSeen !== undefined && now - lastSeen < 15_000) {
          return;
        }

        seenIds.current.set(item.id, now);

        // Remove old IDs to prevent unnecessary memory growth.
        if (seenIds.current.size > 50) {
          for (const [key, time] of seenIds.current) {
            if (now - time > 30_000) {
              seenIds.current.delete(key);
            }
          }
        }

        callbackRef.current(item);
      }
    );

    // Subscribe after registering all callbacks.
    channel.subscribe((status, error) => {
      if (
        status === "CHANNEL_ERROR" ||
        status === "TIMED_OUT"
      ) {
        console.error(
          "[notifications] realtime subscription error:",
          status,
          error
        );
      }
    });

    // Remove only this subscription when the hook unmounts.
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [currentUserId]);
}
