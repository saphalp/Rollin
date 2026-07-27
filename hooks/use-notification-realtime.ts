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

  useEffect(() => {
    if (!currentUserId) return;

    const channel = supabase
      .channel(`notifications-realtime-${currentUserId}-${Date.now()}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${currentUserId}`,
        },
        (payload) => {
          callbackRef.current(payload.new as NotificationPayload);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId]);
}
