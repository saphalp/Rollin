import { useEffect, useRef } from "react";

import { supabase } from "@/lib/supabase";

export type MessagePayload = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
};

export function useMessagesRealtime(
  conversationId: string | undefined,
  onInsert: (message: MessagePayload) => void,
) {
  const callbackRef = useRef(onInsert);
  useEffect(() => {
    callbackRef.current = onInsert;
  }, [onInsert]);

  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`messages-realtime-${conversationId}-${Date.now()}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          callbackRef.current(payload.new as MessagePayload);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);
}
