import ConversationHeader from "@/components/chats/ConversationHeader";
import MessageBubble from "@/components/chats/MessageBubble";
import MessageInput from "@/components/chats/MessageInput";
import SharedContentBubble from "@/components/chats/SharedContentBubble";
import { AppView } from "@/components/view";
import { Colors } from "@/constants/theme";
import { useMessagesRealtime } from "@/hooks/use-messages-realtime";
import { supabase } from "@/lib/supabase";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  useColorScheme,
} from "react-native";

type SharedActivityPreview = {
  id: string;
  title: string;
  hostName: string;
  imageUrl: string;
};

type SharedPostPreview = {
  id: string;
  activityId: string;
  posterName: string;
  caption: string | null;
  imageUrl: string;
};

type Message = {
  id: string;
  text: string;
  fromMe: boolean;
  time: string;
  senderName?: string;
  type: "text" | "activity" | "post";
  sharedActivity?: SharedActivityPreview;
  sharedPost?: SharedPostPreview;
};

const CATEGORY_IMAGES: Record<string, string> = {
  social: "https://picsum.photos/seed/social/240/240",
  sports: "https://picsum.photos/seed/sports/240/240",
  music: "https://picsum.photos/seed/music/240/240",
  study: "https://picsum.photos/seed/study/240/240",
  outdoor: "https://picsum.photos/seed/outdoor/240/240",
  gaming: "https://picsum.photos/seed/gaming/240/240",
  grocery: "https://picsum.photos/seed/grocery/240/240",
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function ChatConversationScreen() {
  const { id, name, avatar } = useLocalSearchParams<{
    id: string;
    name?: string;
    avatar?: string;
  }>();

  const theme = useColorScheme() ?? "light";
  const colors = Colors[theme];

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [conversationType, setConversationType] = useState<"direct" | "group" | null>(null);
  const [participantNames, setParticipantNames] = useState<Record<string, string>>({});
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const scrollRef = useRef<ScrollView>(null);

  async function load() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    const uid = user?.id ?? null;
    setCurrentUserId(uid);

    const { data: conversation, error: conversationError } = await supabase
      .from("conversations")
      .select("id, type, activity_id")
      .eq("id", id)
      .single();

    if (conversationError || !conversation) {
      setLoading(false);
      return;
    }

    setConversationType(conversation.type);

    let names: Record<string, string> = {};
    if (conversation.type === "group") {
      const { data: participants } = await supabase
        .from("conversation_participants")
        .select("user_id")
        .eq("conversation_id", id);

      const participantUserIds = (participants ?? []).map((p: any) => p.user_id);

      const { data: participantProfiles } = participantUserIds.length > 0
        ? await supabase.from("profiles").select("id, full_name").in("id", participantUserIds)
        : { data: [] as any[] };

      const nameById: Record<string, string> = Object.fromEntries(
        (participantProfiles ?? []).map((p: any) => [p.id, p.full_name ?? "Rollin' User"]),
      );

      participantUserIds.forEach((userId: string) => {
        names[userId] = nameById[userId] ?? "Rollin' User";
      });
      setParticipantNames(names);
    }

    const { data: messageRows } = await supabase
      .from("messages")
      .select(
        "id, sender_id, content, type, shared_activity_id, shared_post_id, created_at",
      )
      .eq("conversation_id", id)
      .order("created_at", { ascending: true });

    const rows = messageRows ?? [];

    const postIds = [
      ...new Set(
        rows.filter((m: any) => m.type === "post").map((m: any) => m.shared_post_id),
      ),
    ] as string[];

    const { data: sharedPhotos } =
      postIds.length > 0
        ? await supabase
            .from("activity_photos")
            .select("id, activity_id, user_id, image_path, caption")
            .in("id", postIds)
        : { data: [] as any[] };

    const photoById: Record<string, any> = Object.fromEntries(
      (sharedPhotos ?? []).map((p: any) => [p.id, p]),
    );

    const activityIds = [
      ...new Set([
        ...rows
          .filter((m: any) => m.type === "activity")
          .map((m: any) => m.shared_activity_id),
        ...(sharedPhotos ?? []).map((p: any) => p.activity_id),
      ]),
    ] as string[];

    const { data: sharedActivities } =
      activityIds.length > 0
        ? await supabase
            .from("activities")
            .select("id, title, image_url, category, host_id")
            .in("id", activityIds)
        : { data: [] as any[] };

    const activityById: Record<string, any> = Object.fromEntries(
      (sharedActivities ?? []).map((a: any) => [a.id, a]),
    );

    const sharedProfileIds = [
      ...new Set([
        ...(sharedActivities ?? []).map((a: any) => a.host_id),
        ...(sharedPhotos ?? []).map((p: any) => p.user_id),
      ]),
    ].filter(Boolean) as string[];

    const { data: sharedProfiles } =
      sharedProfileIds.length > 0
        ? await supabase
            .from("profiles")
            .select("id, full_name")
            .in("id", sharedProfileIds)
        : { data: [] as any[] };

    const sharedNameById: Record<string, string> = Object.fromEntries(
      (sharedProfiles ?? []).map((p: any) => [p.id, p.full_name ?? "Rollin' User"]),
    );

    function activityImage(activity: any) {
      return (
        activity?.image_url ??
        CATEGORY_IMAGES[activity?.category ?? ""] ??
        "https://picsum.photos/seed/activity/240/240"
      );
    }

    setMessages(
      rows.map((m: any) => {
        let sharedActivity: SharedActivityPreview | undefined;
        let sharedPost: SharedPostPreview | undefined;

        if (m.type === "activity" && m.shared_activity_id) {
          const activity = activityById[m.shared_activity_id];
          sharedActivity = {
            id: m.shared_activity_id,
            title: activity?.title ?? "An activity",
            hostName: sharedNameById[activity?.host_id] ?? "Rollin' User",
            imageUrl: activityImage(activity),
          };
        }

        if (m.type === "post" && m.shared_post_id) {
          const photo = photoById[m.shared_post_id];
          sharedPost = {
            id: m.shared_post_id,
            activityId: photo?.activity_id,
            posterName: sharedNameById[photo?.user_id] ?? "Rollin' User",
            caption: photo?.caption ?? null,
            imageUrl: photo
              ? supabase.storage.from("activity-photos").getPublicUrl(photo.image_path)
                  .data.publicUrl
              : "https://picsum.photos/seed/post/240/240",
          };
        }

        return {
          id: m.id,
          text: m.content ?? "",
          fromMe: m.sender_id === uid,
          time: formatTime(m.created_at),
          senderName: m.sender_id !== uid ? names[m.sender_id] : undefined,
          type: m.type ?? "text",
          sharedActivity,
          sharedPost,
        };
      }),
    );

    setLoading(false);
  }

  useEffect(() => {
    if (id) load();
  }, [id]);

  useMessagesRealtime(id, (incoming) => {
    if (incoming.type && incoming.type !== "text") {
      void load();
      return;
    }

    setMessages((prev) => {
      if (prev.some((m) => m.id === incoming.id)) return prev;
      return [
        ...prev,
        {
          id: incoming.id,
          text: incoming.content ?? "",
          fromMe: incoming.sender_id === currentUserId,
          time: formatTime(incoming.created_at),
          senderName:
            incoming.sender_id !== currentUserId
              ? participantNames[incoming.sender_id]
              : undefined,
          type: "text",
        },
      ];
    });
  });

  async function send() {
    const trimmed = input.trim();
    if (!trimmed || !currentUserId || !id) return;

    setInput("");

    const { error } = await supabase.from("messages").insert({
      conversation_id: id,
      sender_id: currentUserId,
      content: trimmed,
    });

    if (error) {
      console.error("[chat] send failed:", error);
    }
  }

  return (
    <AppView style={styles.container}>
      <ConversationHeader name={name ?? "Chat"} avatar={{ uri: avatar ?? "" }} />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
        keyboardVerticalOffset={0}
      >
        {loading ? (
          <ActivityIndicator color={colors.tint} style={styles.loader} />
        ) : (
          <ScrollView
            ref={scrollRef}
            style={{ backgroundColor: colors.background }}
            contentContainerStyle={styles.messages}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          >
            {messages.map((m) => {
              const senderName =
                conversationType === "group" ? m.senderName : undefined;

              if (m.type === "activity" && m.sharedActivity) {
                return (
                  <SharedContentBubble
                    key={m.id}
                    kind="activity"
                    fromMe={m.fromMe}
                    time={m.time}
                    senderName={senderName}
                    title={m.sharedActivity.title}
                    hostName={m.sharedActivity.hostName}
                    imageUrl={m.sharedActivity.imageUrl}
                    onPress={() =>
                      router.push(`/activity/${m.sharedActivity!.id}`)
                    }
                  />
                );
              }

              if (m.type === "post" && m.sharedPost) {
                return (
                  <SharedContentBubble
                    key={m.id}
                    kind="post"
                    fromMe={m.fromMe}
                    time={m.time}
                    senderName={senderName}
                    posterName={m.sharedPost.posterName}
                    caption={m.sharedPost.caption}
                    imageUrl={m.sharedPost.imageUrl}
                    onPress={() =>
                      router.push(`/activity/${m.sharedPost!.activityId}`)
                    }
                  />
                );
              }

              return (
                <MessageBubble
                  key={m.id}
                  text={m.text}
                  fromMe={m.fromMe}
                  time={m.time}
                  senderName={senderName}
                />
              );
            })}
          </ScrollView>
        )}

        <MessageInput value={input} onChangeText={setInput} onSend={send} />
      </KeyboardAvoidingView>
    </AppView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  loader: {
    flex: 1,
  },
  messages: {
    paddingVertical: 12,
    gap: 4,
  },
});
