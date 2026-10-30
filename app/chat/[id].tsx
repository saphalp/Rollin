import ConversationHeader from "@/components/chats/ConversationHeader";
import MessageBubble from "@/components/chats/MessageBubble";
import MessageInput from "@/components/chats/MessageInput";
import SharedContentBubble from "@/components/chats/SharedContentBubble";
import { AppView } from "@/components/view";
import { Colors } from "@/constants/theme";
import { useMessagesRealtime } from "@/hooks/use-messages-realtime";
import { resolveAvatarUri } from "@/lib/profile/resolve-avatar-uri";
import { supabase } from "@/lib/supabase";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform, ScrollView, StyleSheet, Text, View,
  useColorScheme, type ScrollViewInstance
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
  senderId?: string;
  text: string;
  fromMe: boolean;
  time: string;
  createdAt: string;
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

// Compare local calendar days, not UTC dates, so midnight is correct for the user.
function messageDay(iso: string): string {
  return new Date(iso).toDateString();
}

function formatMessageDay(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function ChatConversationScreen() {
  const { id, name, avatar, otherUserId: paramOtherUserId } = useLocalSearchParams<{
    id: string;
    name?: string;
    avatar?: string;
    otherUserId?: string;
  }>();

  const theme = useColorScheme() ?? "light";
  const colors = Colors[theme];

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [conversationType, setConversationType] = useState<"direct" | "group" | null>(null);
  const [otherUserId, setOtherUserId] = useState<string | null>(paramOtherUserId ?? null);
  const [activityId, setActivityId] = useState<string | null>(null);
  const [participantNames, setParticipantNames] = useState<Record<string, string>>({});
  const [senderAvatars, setSenderAvatars] = useState<Record<string, string>>({});
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [muted, setMuted] = useState(false);
  const [headerName, setHeaderName] = useState<string | null>(null);
  const [headerAvatar, setHeaderAvatar] = useState<string | null>(null);

  useEffect(() => {
    if (!id || !currentUserId) return;
    supabase
      .from("muted_conversations")
      .select("conversation_id")
      .eq("conversation_id", id)
      .eq("user_id", currentUserId)
      .maybeSingle()
      .then(({ data }) => setMuted(!!data));
  }, [id, currentUserId]);

  async function toggleMute() {
    if (!id || !currentUserId) return;
    const next = !muted;
    setMuted(next);
    const { error } = next
      ? await supabase
        .from("muted_conversations")
        .insert({ conversation_id: id, user_id: currentUserId })
      : await supabase
        .from("muted_conversations")
        .delete()
        .eq("conversation_id", id)
        .eq("user_id", currentUserId);
    if (error) setMuted(!next);
  }

  const scrollRef = useRef<ScrollViewInstance>(null);
  const isNearBottom = useRef(true);
  const initialScrollPending = useRef(true);
  const sendingRef = useRef(false);
  const screenFocused = useRef(false);

  // Reset scroll behavior only when opening a different conversation.
  useEffect(() => {
    initialScrollPending.current = true;
    isNearBottom.current = true;
  }, [id]);

  function handleScroll(event: {
    nativeEvent: {
      contentOffset: { y: number };
      contentSize: { height: number };
      layoutMeasurement: { height: number };
    };
  }) {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const distanceFromBottom = contentSize.height - layoutMeasurement.height - contentOffset.y;
    isNearBottom.current = distanceFromBottom <= 100;
  }

  function handleContentSizeChange() {
    if (initialScrollPending.current) {
      initialScrollPending.current = false;
      scrollRef.current?.scrollToEnd({ animated: false });
    } else if (isNearBottom.current) {
      scrollRef.current?.scrollToEnd({ animated: true });
    }
  }

  const markRead = useCallback(async () => {
    if (!id || !currentUserId || !screenFocused.current) return;
    const { error } = await supabase.rpc("mark_conversation_read", {
      p_conversation_id: id,
    });
    if (error) console.warn("[chat] mark read failed:", error.message);
  }, [id, currentUserId]);

  useFocusEffect(useCallback(() => {
    screenFocused.current = true;
    if (!loading && currentUserId) void markRead();
    return () => { screenFocused.current = false; };
  }, [loading, currentUserId, markRead]));

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
    if (conversation.activity_id) {
      setActivityId(conversation.activity_id);
    }

    let otherId = paramOtherUserId ?? null;
    if (!otherId && conversation.type === "direct" && uid) {
      const { data: otherParticipant } = await supabase
        .from("conversation_participants")
        .select("user_id")
        .eq("conversation_id", id)
        .neq("user_id", uid)
        .maybeSingle();

      if (otherParticipant?.user_id) {
        otherId = otherParticipant.user_id;
      }
    }
    if (otherId) {
      setOtherUserId(otherId);
    }

    // Resolve header details even when notification/deep-link route params are absent.
    if (conversation.type === "direct" && otherId) {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("full_name, profile_picture")
        .eq("id", otherId)
        .maybeSingle();
      if (profileError) console.warn("[chat] header profile lookup failed:", profileError.message);
      setHeaderName(profile?.full_name?.trim() || "Rollin' User");
      setHeaderAvatar(resolveAvatarUri(profile?.profile_picture));
    } else if (conversation.type === "group" && conversation.activity_id) {
      const { data: activity, error: activityError } = await supabase
        .from("activities")
        .select("title, image_url, category")
        .eq("id", conversation.activity_id)
        .maybeSingle();
      if (activityError) console.warn("[chat] header activity lookup failed:", activityError.message);
      setHeaderName(activity?.title?.trim() || "Activity chat");
      setHeaderAvatar(
        activity?.image_url ||
        CATEGORY_IMAGES[activity?.category ?? ""] ||
        CATEGORY_IMAGES.social,
      );
    }

    const { data: messageRows } = await supabase
      .from("messages")
      .select(
        "id, sender_id, content, type, shared_activity_id, shared_post_id, created_at",
      )
      .eq("conversation_id", id)
      .order("created_at", { ascending: true });

    const rows = messageRows ?? [];

    // Look up message senders from history, including people who left the chat.
    // This also works for direct chats and gives each sender their own avatar.
    const senderIds = [...new Set(
      rows.map((message) => message.sender_id).filter(Boolean),
    )] as string[];
    let names: Record<string, string> = {};
    const avatars: Record<string, string> = {};

    if (senderIds.length > 0) {
      const { data: senderProfiles, error: senderError } = await supabase
        .from("profiles")
        .select("id, full_name, profile_picture")
        .in("id", senderIds);

      if (senderError) {
        console.warn("[chat] sender profiles lookup failed:", senderError.message);
      }

      for (const profile of senderProfiles ?? []) {
        names[profile.id] = profile.full_name?.trim() || "Rollin' User";
        avatars[profile.id] = resolveAvatarUri(profile.profile_picture);
      }
      for (const senderId of senderIds) {
        if (!names[senderId]) names[senderId] = "Rollin' User";
      }
    }
    setSenderAvatars(avatars);
    if (conversation.type === "group") setParticipantNames(names);


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
          senderId: m.sender_id,
          text: m.content ?? "",
          fromMe: m.sender_id === uid,
          time: formatTime(m.created_at),
          createdAt: m.created_at,
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
    // A message visible in the open chat is read, regardless of its type.
    if (screenFocused.current && currentUserId && incoming.sender_id !== currentUserId) {
      void markRead();
    }
    // If this person has not appeared in the loaded history, fetch their avatar.
    if (incoming.sender_id && incoming.sender_id !== currentUserId && !senderAvatars[incoming.sender_id]) {
      void supabase.from("profiles")
        .select("id, full_name, profile_picture")
        .eq("id", incoming.sender_id)
        .maybeSingle()
        .then(({ data }) => {
          if (!data) return;
          setSenderAvatars((prev) => ({
            ...prev,
            [data.id]: resolveAvatarUri(data.profile_picture),
          }));
          if (conversationType === "group") {
            setParticipantNames((prev) => ({
              ...prev,
              [data.id]: data.full_name?.trim() || "Rollin' User",
            }));
          }
        });
    }
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
          senderId: incoming.sender_id,
          text: incoming.content ?? "",
          fromMe: incoming.sender_id === currentUserId,
          time: formatTime(incoming.created_at),
          createdAt: incoming.created_at,
          senderName:
            incoming.sender_id !== currentUserId
              ? participantNames[incoming.sender_id] ?? "Rollin' User"
              : undefined,
          type: "text",
        },
      ];
    });
  });

  async function send() {
    const trimmed = input.trim();
    if (sendingRef.current || !trimmed || !currentUserId || !id) return;

    // Lock synchronously so rapid taps cannot start multiple inserts.
    sendingRef.current = true;
    try {
      const { data: sent, error } = await supabase
        .from("messages")
        .insert({
          conversation_id: id,
          sender_id: currentUserId,
          content: trimmed,
        })
        .select("id")
        .single();

      if (error) throw error;

      // After sending, follow the new message even if we were reading history.
      isNearBottom.current = true;
      scrollRef.current?.scrollToEnd({ animated: true });

      // Only clear the draft after the database confirms the send.
      // Preserve anything the user typed while the request was pending.
      setInput((current) => current.trim() === trimmed ? "" : current);

      // A notification failure must not make a successfully sent message
      // appear to have failed (which could cause an accidental resend).
      void supabase.functions.invoke("notify-message", {
        body: { messageId: sent.id },
      }).catch((notifyError) => {
        console.warn("[chat] notification failed:", notifyError);
      });
    } catch (error) {
      console.error("[chat] send failed:", error);
      Alert.alert("Message not sent", "Your message is still here. Check your connection and try again.");
    } finally {
      sendingRef.current = false;
    }
  }

  return (
    <AppView style={styles.container}>
      <ConversationHeader
        name={headerName ?? name ?? "Chat"}
        avatar={{ uri: headerAvatar ?? avatar ?? "" }}
        muted={muted}
        onToggleMute={toggleMute}
        onPressProfile={
          otherUserId
            ? () => router.push(`/profile/${otherUserId}`)
            : activityId
              ? () => router.push(`/activity/${activityId}`)
              : undefined
        }
      />

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
            keyboardShouldPersistTaps="handled"
            onScroll={handleScroll}
            scrollEventThrottle={16}
            onContentSizeChange={handleContentSizeChange}
          >
            {messages.map((m, index) => {
              const senderName =
                conversationType === "group" ? m.senderName : undefined;

              const nextMessage = messages[index + 1];
              const showSenderAvatar = !m.fromMe && !!m.senderId && (
                !nextMessage || nextMessage.senderId !== m.senderId ||
                messageDay(nextMessage.createdAt) !== messageDay(m.createdAt)
              );

              const previous = messages[index - 1];
              const showDate = !previous || messageDay(previous.createdAt) !== messageDay(m.createdAt);
              const dateDivider = showDate ? (
                <View style={styles.dateDivider}>
                  <Text style={[styles.dateLabel, { color: colors.icon, backgroundColor: colors.surfaceContainerHigh }]}>
                    {formatMessageDay(m.createdAt)}
                  </Text>
                </View>
              ) : null;

              if (m.type === "activity" && m.sharedActivity) {
                return (
                  <Fragment key={m.id}>
                    {dateDivider}
                    <SharedContentBubble
                      kind="activity"
                      fromMe={m.fromMe}
                      time={m.time}
                      senderName={senderName}
                      onPressSender={
                        !m.fromMe && m.senderId
                          ? () => router.push(`/profile/${m.senderId}`)
                          : undefined
                      }
                      title={m.sharedActivity.title}
                      hostName={m.sharedActivity.hostName}
                      imageUrl={m.sharedActivity.imageUrl}
                      onPress={() => router.push(`/activity/${m.sharedActivity!.id}`)}
                    />
                  </Fragment>
                );
              }

              if (m.type === "post" && m.sharedPost) {
                return (
                  <Fragment key={m.id}>
                    {dateDivider}
                    <SharedContentBubble
                      kind="post"
                      fromMe={m.fromMe}
                      time={m.time}
                      senderName={senderName}
                      onPressSender={
                        !m.fromMe && m.senderId
                          ? () => router.push(`/profile/${m.senderId}`)
                          : undefined
                      }
                      posterName={m.sharedPost.posterName}
                      caption={m.sharedPost.caption}
                      imageUrl={m.sharedPost.imageUrl}
                      onPress={() => router.push(`/post/${m.sharedPost!.id}`)}
                    />
                  </Fragment>
                );
              }

              return (
                <Fragment key={m.id}>
                  {dateDivider}
                  <MessageBubble
                    text={m.text}
                    fromMe={m.fromMe}
                    time={m.time}
                    senderName={senderName}
                    avatarUri={m.senderId ? senderAvatars[m.senderId] : undefined}
                    showAvatar={showSenderAvatar}
                    onPressSender={
                      !m.fromMe && m.senderId
                        ? () => router.push(`/profile/${m.senderId}`)
                        : undefined
                    }
                  />
                </Fragment>
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
  dateDivider: {
    alignItems: "center",
    paddingVertical: 12,
  },
  dateLabel: {
    fontSize: 12,
    fontWeight: "600",
    overflow: "hidden",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
});
