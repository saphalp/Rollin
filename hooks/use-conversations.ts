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
  isArchived: boolean;
  isRead: boolean;
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

  const [activeConversations, setActiveConversations] = useState<ConversationSummary[]>([]);
  const [archivedConversations, setArchivedConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchConversations = useCallback(async () => {
    if (!currentUserId) {
      setActiveConversations([]);
      setArchivedConversations([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const { data: participantRows, error: participantError } = await supabase
      .from("conversation_participants")
      .select("conversation_id, last_read_at")
      .eq("user_id", currentUserId);

    if (participantError || !participantRows || participantRows.length === 0) {
      setActiveConversations([]);
      setArchivedConversations([]);
      setLoading(false);
      return;
    }

    const conversationIds = participantRows.map((r: any) => r.conversation_id);
    const readAtByConversation = new Map<string, string | null>(
      participantRows.map((row) => [row.conversation_id, row.last_read_at]),
    );

    const [conversationRowsResult, deletedRowsResult] = await Promise.all([
      supabase
        .from("conversations")
        .select("id, type, activity_id, created_at, is_archived")
        .in("id", conversationIds),
      supabase
        .from("deleted_conversations")
        .select("conversation_id, deleted_at")
        .eq("user_id", currentUserId),
    ]);

    // Fetch only the most recent message per conversation. Limit concurrency so
    // a user with many chats does not launch hundreds of requests at once.
    const allConversationRows = conversationRowsResult.data ?? [];
    const lastMessageByConversation: Record<string, {
      conversation_id: string;
      content: string | null;
      type: string | null;
      created_at: string;
      sender_id: string;
    }> = {};

    for (let start = 0; start < allConversationRows.length; start += 8) {
      const batch = allConversationRows.slice(start, start + 8);
      const results = await Promise.all(batch.map((conversation) =>
        supabase
          .from("messages")
          .select("conversation_id, content, type, created_at, sender_id")
          .eq("conversation_id", conversation.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      ));
      if (results.some((result) => result.error)) {
        console.error("[chats] latest-message lookup failed", results.find((result) => result.error)?.error);
        setLoading(false);
        return;
      }
      results.forEach(({ data }, index) => {
        if (data) lastMessageByConversation[batch[index].id] = data;
      });
    }

    // Keep the previous deletion behavior: a chat becomes visible again only
    // when its most recent message is newer than that user's deletion time.
    const deletedAtById = new Map(
      (deletedRowsResult.data ?? []).map((row) => [row.conversation_id, row.deleted_at]),
    );
    const conversationRows = allConversationRows.filter((conversation) => {
      if (!deletedAtById.has(conversation.id)) return true;
      const deletedAt = deletedAtById.get(conversation.id);
      const latest = lastMessageByConversation[conversation.id];
      return !!deletedAt && !!latest &&
        new Date(latest.created_at).getTime() > new Date(deletedAt).getTime();
    });

    if (conversationRows.length === 0) {
      setActiveConversations([]);
      setArchivedConversations([]);
      setLoading(false);
      return;
    }

    const directIds = conversationRows
      .filter((c: any) => c.type === "direct")
      .map((c: any) => c.id);
    const groupConversations = conversationRows.filter((c: any) => c.type === "group");
    const activityIds = groupConversations.map((c: any) => c.activity_id).filter(Boolean);

    const [otherParticipantRowsResult, activitiesResult] = await Promise.all([
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

    const summaries: ConversationSummary[] = conversationRows.map((c: any) => {
      const lastMessage = lastMessageByConversation[c.id];
      const lastReadAt = readAtByConversation.get(c.id);
      // A conversation is unread only if its latest message came from someone
      // else and is newer than this participant's own last-read timestamp.
      const isRead = !lastMessage || lastMessage.sender_id === currentUserId ||
        (!!lastReadAt && new Date(lastReadAt).getTime() >= new Date(lastMessage.created_at).getTime());

      if (c.type === "direct") {
        const other = otherParticipantByConversation[c.id];
        return {
          id: c.id,
          type: "direct" as const,
          title: other?.full_name ?? "Rollin' User",
          avatarUri: resolveAvatarUri(other?.profile_picture),
          lastMessage: lastMessage?.content ??
            (lastMessage?.type === "activity" ? "Shared an activity" :
              lastMessage?.type === "post" ? "Shared a post" : "Say hello!"),
          lastMessageAt: lastMessage?.created_at ?? c.created_at,
          otherUserId: other?.id,
          isArchived: false,
          isRead,
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
        lastMessage: lastMessage?.content ??
          (lastMessage?.type === "activity" ? "Shared an activity" :
            lastMessage?.type === "post" ? "Shared a post" : "Say hello to the group!"),
        lastMessageAt: lastMessage?.created_at ?? c.created_at,
        activityId: c.activity_id,
        isArchived: !!c.is_archived,
        isRead,
      };
    });

    summaries.sort((a, b) => {
      if (!a.lastMessageAt) return 1;
      if (!b.lastMessageAt) return -1;
      return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
    });

    setActiveConversations(summaries.filter((s) => !s.isArchived));
    setArchivedConversations(summaries.filter((s) => s.isArchived));
    setLoading(false);
  }, [currentUserId]);

  const deleteConversation = useCallback(async (conversationId: string) => {
    if (!currentUserId) return;
    const { error } = await supabase.from("deleted_conversations").upsert({
      user_id: currentUserId,
      conversation_id: conversationId,
      deleted_at: new Date().toISOString(),
    }, { onConflict: "user_id,conversation_id" });
    if (error) throw error;
    setActiveConversations((prev) => prev.filter((c) => c.id !== conversationId));
    setArchivedConversations((prev) => prev.filter((c) => c.id !== conversationId));
  }, [currentUserId]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  return {
    conversations: activeConversations,
    activeConversations,
    archivedConversations,
    loading,
    refresh: fetchConversations,
    formatTime,
    deleteConversation,
  };
}
