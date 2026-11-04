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

export function useNotificationRealtime(
  onInsert: (n: NotificationPayload) => void,
) {
  const { claims } = useAuthContext();
  const currentUserId = claims?.sub as string | undefined;

  const callbackRef = useRef(onInsert);
  useEffect(() => {
    callbackRef.current = onInsert;
  }, [onInsert]);

  const seenIds = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    if (!currentUserId) return;

    const channel = supabase
      .channel(`notifications-realtime-${currentUserId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${currentUserId}`,
        },
        (payload) => {
          const item = payload.new as NotificationPayload;
          if (!item?.id) return;

          const now = Date.now();
          const lastSeen = seenIds.current.get(item.id);
          if (lastSeen && now - lastSeen < 15_000) {
            return;
          }
          seenIds.current.set(item.id, now);

          // Clean older entries
          if (seenIds.current.size > 50) {
            for (const [key, time] of seenIds.current) {
              if (now - time > 30_000) seenIds.current.delete(key);
            }
          }

          callbackRef.current(item);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [currentUserId]);
}
