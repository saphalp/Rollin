import { useCallback, useEffect, useState } from "react";

import { useAuthContext } from "@/hooks/use-auth-context";
import { resolveAvatarUri } from "@/lib/profile/resolve-avatar-uri";
import { supabase } from "@/lib/supabase";

export type ConversationSummary = {
  id: string;
  type: "direct" | "group";
  title: string;
  avatarUri: string;
  lastMessage: string;
  lastMessageAt: string | null;
  otherUserId?: string;
  activityId?: string;
};

const CATEGORY_FALLBACK_IMAGE: Record<string, string> = {
  social: "https://picsum.photos/seed/social/240/240",
  sports: "https://picsum.photos/seed/sports/240/240",
  music: "https://picsum.photos/seed/music/240/240",
  study: "https://picsum.photos/seed/study/240/240",
  outdoor: "https://picsum.photos/seed/outdoor/240/240",
  gaming: "https://picsum.photos/seed/gaming/240/240",
  grocery: "https://picsum.photos/seed/grocery/240/240",
};

function formatTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function useConversations() {
  const { claims } = useAuthContext();
  const currentUserId = claims?.sub as string | undefined;

  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchConversations = useCallback(async () => {
    if (!currentUserId) {
      setConversations([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const { data: participantRows, error: participantError } = await supabase
      .from("conversation_participants")
      .select("conversation_id")
      .eq("user_id", currentUserId);

    if (participantError || !participantRows || participantRows.length === 0) {
      setConversations([]);
      setLoading(false);
      return;
    }

    const conversationIds = participantRows.map((r: any) => r.conversation_id);

    const { data: conversationRows } = await supabase
      .from("conversations")
      .select("id, type, activity_id, created_at")
      .in("id", conversationIds);

    const directIds = (conversationRows ?? [])
      .filter((c: any) => c.type === "direct")
      .map((c: any) => c.id);
    const groupConversations = (conversationRows ?? []).filter((c: any) => c.type === "group");
    const activityIds = groupConversations.map((c: any) => c.activity_id).filter(Boolean);

    const [otherParticipantRowsResult, activitiesResult, messagesResult] = await Promise.all([
      directIds.length > 0
        ? supabase
            .from("conversation_participants")
            .select("conversation_id, user_id")
            .in("conversation_id", directIds)
            .neq("user_id", currentUserId)
        : Promise.resolve({ data: [] as any[] }),
      activityIds.length > 0
        ? supabase
            .from("activities")
            .select("id, title, image_url, category")
            .in("id", activityIds)
        : Promise.resolve({ data: [] as any[] }),
      supabase
        .from("messages")
        .select("conversation_id, content, created_at")
        .in("conversation_id", conversationIds)
        .order("created_at", { ascending: false }),
    ]);

    const otherParticipantRows = otherParticipantRowsResult.data ?? [];
    const otherUserIds = [...new Set(otherParticipantRows.map((r: any) => r.user_id))];

    const { data: otherProfiles } = otherUserIds.length > 0
      ? await supabase.from("profiles").select("id, full_name, profile_picture").in("id", otherUserIds)
      : { data: [] as any[] };

    const profileById: Record<string, any> = Object.fromEntries(
      (otherProfiles ?? []).map((p: any) => [p.id, p]),
    );

    const otherParticipantByConversation: Record<string, any> = {};
    for (const row of otherParticipantRows) {
      otherParticipantByConversation[row.conversation_id] = profileById[row.user_id];
    }

    const activityById: Record<string, any> = {};
    for (const activity of activitiesResult.data ?? []) {
      activityById[activity.id] = activity;
    }

    const lastMessageByConversation: Record<string, any> = {};
    for (const message of messagesResult.data ?? []) {
      if (!lastMessageByConversation[message.conversation_id]) {
        lastMessageByConversation[message.conversation_id] = message;
      }
    }

    const summaries: ConversationSummary[] = (conversationRows ?? []).map((c: any) => {
      const lastMessage = lastMessageByConversation[c.id];

      if (c.type === "direct") {
        const other = otherParticipantByConversation[c.id];
        return {
          id: c.id,
          type: "direct" as const,
          title: other?.full_name ?? "Rollin' User",
          avatarUri: resolveAvatarUri(other?.profile_picture),
          lastMessage: lastMessage?.content ?? "Say hello!",
          lastMessageAt: lastMessage?.created_at ?? c.created_at,
          otherUserId: other?.id,
        };
      }

      const activity = activityById[c.activity_id];
      return {
        id: c.id,
        type: "group" as const,
        title: activity?.title ?? "Activity chat",
        avatarUri:
          activity?.image_url ??
          CATEGORY_FALLBACK_IMAGE[activity?.category ?? ""] ??
          CATEGORY_FALLBACK_IMAGE.social,
        lastMessage: lastMessage?.content ?? "Say hello to the group!",
        lastMessageAt: lastMessage?.created_at ?? c.created_at,
        activityId: c.activity_id,
      };
    });

    summaries.sort((a, b) => {
      if (!a.lastMessageAt) return 1;
      if (!b.lastMessageAt) return -1;
      return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
    });

    setConversations(summaries);
    setLoading(false);
  }, [currentUserId]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  return { conversations, loading, refresh: fetchConversations, formatTime };
}
