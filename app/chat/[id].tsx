import ConversationHeader from "@/components/chats/ConversationHeader";
import MessageBubble from "@/components/chats/MessageBubble";
import MessageInput from "@/components/chats/MessageInput";
import SharedContentBubble from "@/components/chats/SharedContentBubble";
import { AppView } from "@/components/view";
import { Colors } from "@/constants/theme";
import { useConversations } from "@/hooks/use-conversations";
import { useMessagesRealtime } from "@/hooks/use-messages-realtime";
import { resolveAvatarUri } from "@/lib/profile/resolve-avatar-uri";
import { supabase } from "@/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView, StyleSheet, Text, TextInput,
  View,
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
  replyToMessageId?: string | null;
  deletedForEveryone?: boolean;
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
  const params = useLocalSearchParams<{ id: string; name?: string; avatar?: string }>();
  const { claims } = useAuthContext();
  // A different account or chat gets a fresh composer and scroll position.
  return <Conversation key={`${claims?.sub}:${params.id}`} {...params} />;
}

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [conversationType, setConversationType] = useState<"direct" | "group" | null>(null);
  const [otherUserId, setOtherUserId] = useState<string | null>(paramOtherUserId ?? null);
  const [activityId, setActivityId] = useState<string | null>(null);
  const [participantNames, setParticipantNames] = useState<Record<string, string>>({});
  const [senderAvatars, setSenderAvatars] = useState<Record<string, string>>({});
  const [messages, setMessages] = useState<Message[]>([]);
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const [changingMessage, setChangingMessage] = useState(false);
  const visibleMessages = useMemo(() => messages.filter((m) => !hiddenIds.includes(m.id)), [messages, hiddenIds]);
  const pinnedMessage = visibleMessages.find((m) => m.id === pinnedId && !m.deletedForEveryone);
  const [reactionsByMessage, setReactionsByMessage] = useState<Record<string, { emoji: string; user_id: string }[]>>({});
  const messageById = useMemo(() => new Map(messages.map((m) => [m.id, m])), [messages]);
  const refreshPinAndHidden = useCallback(async () => {
    if (!id || !currentUserId) return;
    const [pins, hidden] = await Promise.all([
      supabase.from("conversation_pins").select("message_id").eq("conversation_id", id).maybeSingle(),
      supabase.from("hidden_chat_messages").select("message_id").eq("conversation_id", id).eq("user_id", currentUserId),
    ]);
    if (pins.error) console.warn("[chat] load pin failed:", pins.error.message);
    else setPinnedId(pins.data?.message_id ?? null);
    if (hidden.error) console.warn("[chat] load hidden messages failed:", hidden.error.message);
    else setHiddenIds((hidden.data ?? []).map((row) => row.message_id));
  }, [id, currentUserId]);

  useEffect(() => { void refreshPinAndHidden(); }, [refreshPinAndHidden]);

  useEffect(() => {
    if (!id || !currentUserId) return;
    const channel = supabase.channel(`chat-pin-delete-${id}-${currentUserId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "conversation_pins", filter: `conversation_id=eq.${id}` }, () => { void refreshPinAndHidden(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "hidden_chat_messages", filter: `user_id=eq.${currentUserId}` }, () => { void refreshPinAndHidden(); })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages", filter: `conversation_id=eq.${id}` }, () => { void load(); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [id, currentUserId, refreshPinAndHidden]);

  async function pinOrUnpin(message: Message) {
    if (!id || changingMessage) return;
    setChangingMessage(true);
    try {
      const wasPinned = pinnedId === message.id;
      const { error } = wasPinned
        ? await supabase.rpc("unpin_chat_message", { p_conversation_id: id })
        : await supabase.rpc("pin_chat_message", { p_message_id: message.id });
      if (error) throw error;
      setPinnedId(wasPinned ? null : message.id);
    } catch (error) {
      console.error("[chat] pin failed:", error);
      Alert.alert("Could not change pin", "Please check your connection and try again.");
    } finally { setChangingMessage(false); }
  }

  function confirmDeleteMessage(message: Message) {
    const options: { text: string; style?: "cancel" | "destructive"; onPress?: () => void }[] = [
      { text: "Delete for me", style: "destructive", onPress: () => { void deleteMessage(message, false); } },
    ];
    if (message.fromMe) options.push({ text: "Delete for everyone", style: "destructive", onPress: () => { void deleteMessage(message, true); } });
    options.push({ text: "Cancel", style: "cancel" });
    Alert.alert("Delete message", message.fromMe ? "Choose who can no longer see this message." : "Remove this message from your chat only?", options);
  }

  async function deleteMessage(message: Message, forEveryone: boolean) {
    if (changingMessage) return;
    setChangingMessage(true);
    try {
      const { error } = await supabase.rpc("delete_chat_message", { p_message_id: message.id, p_for_everyone: forEveryone });
      if (error) throw error;
      if (forEveryone) {
        setMessages((previous) => previous.map((m) => m.id === message.id ? { ...m, text: "", type: "text", sharedActivity: undefined, sharedPost: undefined, deletedForEveryone: true } : m));
      } else {
        setHiddenIds((previous) => previous.includes(message.id) ? previous : [...previous, message.id]);
      }
      if (pinnedId === message.id) setPinnedId(null);
      if (replyingTo?.id === message.id) setReplyingTo(null);
      void refreshPinAndHidden();
    } catch (error) {
      console.error("[chat] delete failed:", error);
      Alert.alert("Could not delete message", "Please try again.");
    } finally { setChangingMessage(false); }
  }

  const reactionMessageIds = messages.map((m) => m.id).join(",");
  const reactionIdsRef = useRef<string[]>([]);
  reactionIdsRef.current = messages.map((m) => m.id);

  const refreshReactions = useCallback(async () => {
    const ids = reactionIdsRef.current;
    if (!ids.length) { setReactionsByMessage({}); return; }
    const { data, error } = await supabase.from("message_reactions")
      .select("message_id, user_id, emoji").in("message_id", ids);
    if (error) { console.warn("[chat] load reactions:", error.message); return; }
    const next: Record<string, { emoji: string; user_id: string }[]> = {};
    for (const reaction of data ?? []) {
      (next[reaction.message_id] ??= []).push({ emoji: reaction.emoji, user_id: reaction.user_id });
    }
    setReactionsByMessage(next);
  }, []);

  useEffect(() => { void refreshReactions(); }, [reactionMessageIds, refreshReactions]);

  useEffect(() => {
    if (!id) return;
    const channel = supabase.channel(`message-reactions-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "message_reactions" },
        () => { void refreshReactions(); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [id, refreshReactions]);

  async function toggleReaction(messageId: string, emoji: string) {
    if (!currentUserId) return;
    const mine = reactionsByMessage[messageId]?.find((r) => r.user_id === currentUserId);
    const query = supabase.from("message_reactions");
    const { error } = mine?.emoji === emoji
      ? await query.delete().eq("message_id", messageId).eq("user_id", currentUserId)
      : await query.upsert({ message_id: messageId, user_id: currentUserId, emoji }, { onConflict: "message_id,user_id" });
    if (error) Alert.alert("Reaction failed", error.message);
    else await refreshReactions();
  }

  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [forwardingMessage, setForwardingMessage] = useState<Message | null>(null);
  const [forwarding, setForwarding] = useState(false);
  const forwardingRef = useRef(false);
  const [forwardQuery, setForwardQuery] = useState("");
  const [forwardedTo, setForwardedTo] = useState<string[]>([]);
  const [forwardingTo, setForwardingTo] = useState<string | null>(null);
  const { activeConversations, refresh: refreshForwardConversations } = useConversations();

  function beginForward(message: Message) {
    setForwardingMessage(message);
    setForwardQuery("");
    setForwardedTo([]);
    void refreshForwardConversations();
  }

  async function forwardTo(conversationId: string) {
    if (!forwardingMessage || !currentUserId || forwardingRef.current || forwardedTo.includes(conversationId)) return;
    forwardingRef.current = true;
    setForwarding(true);
    setForwardingTo(conversationId);
    try {
      // Forwarded text is a new message; the original stays unchanged.
      const { data, error } = await supabase.from("messages")
        .insert({
          conversation_id: conversationId,
          sender_id: currentUserId,
          content: `↪ Forwarded message\n${forwardingMessage.text}`,
        })
        .select("id").single();
      if (error) throw error;
      setForwardedTo((previous) => [...previous, conversationId]);
      if (data?.id) {
        void supabase.functions.invoke("notify-message", { body: { messageId: data.id } })
          .catch((error) => console.warn("[chat] forward notification failed:", error));
      }
    } catch (error) {
      console.error("[chat] forward failed:", error);
      Alert.alert("Could not forward", "Please check the conversation and try again.");
    } finally {
      forwardingRef.current = false;
      setForwarding(false);
      setForwardingTo(null);
    }
  }
  const filteredForwardConversations = activeConversations.filter((conversation) =>
    conversation.title.toLocaleLowerCase().includes(forwardQuery.trim().toLocaleLowerCase()),
  );
  const [muted, setMuted] = useState(false);
  const [headerName, setHeaderName] = useState<string | null>(null);
  const [headerAvatar, setHeaderAvatar] = useState<string | null>(null);

  // Messenger-style swipe-left: reveal timestamps in the right gutter, then spring back.
  // Only claim horizontal gestures, leaving vertical scrolling and taps intact.
  const swipeOffset = useRef(new Animated.Value(0)).current;
  const swipeResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_event, gesture) =>
      gesture.dx < -12 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.5,
    onPanResponderMove: (_event, gesture) => {
      swipeOffset.setValue(Math.max(-78, Math.min(0, gesture.dx)));
    },
    onPanResponderRelease: () => {
      Animated.spring(swipeOffset, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start();
    },
    onPanResponderTerminate: () => {
      Animated.spring(swipeOffset, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start();
    },
  }), [swipeOffset]);


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
    if (currentUserId) void refreshPinAndHidden();
    return () => { screenFocused.current = false; };
  }, [loading, currentUserId, markRead, refreshPinAndHidden]));

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
        "id, sender_id, content, type, shared_activity_id, shared_post_id, reply_to_message_id, created_at, deleted_for_everyone",
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
          replyToMessageId: m.reply_to_message_id,
          deletedForEveryone: !!m.deleted_for_everyone,
        };
      }),
    );

    setLoading(false);
  }

  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKeyboardVisible(true));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboardVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);

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
    // Reload linked replies so the quoted message is resolved from the database.
    if ((incoming as typeof incoming & { reply_to_message_id?: string | null }).reply_to_message_id) {
      void load();
      return;
    }
    if (incoming.type && incoming.type !== "text") {
      void load();
      return;
    }
    return () => { active = false; };
  }, [id, chat.userId]);

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
    return () => subscription.remove();
  }, []);

  async function toggleMute() {
    if (!chat.userId || muteBusy) return;
    setMuteBusy(true);
    const { error } = muted
      ? await supabase.from('muted_conversations').delete().eq('conversation_id', id).eq('user_id', chat.userId)
      : await supabase.from('muted_conversations').insert({ conversation_id: id, user_id: chat.userId });
    if (error) Alert.alert('Could not update notifications', 'Please try again.');
    else setMuted(!muted);
    setMuteBusy(false);
  }
  function markVisibleRead() {
    if (atBottom.current && latest) void chat.markRead(latest.id);
  }
  async function send() {
    const trimmed = input.trim();
    if (sendingRef.current || !trimmed || !currentUserId || !id) return;

    // Lock synchronously so rapid taps cannot start multiple inserts.
    sendingRef.current = true;
    const replyId = replyingTo?.id ?? null;
    try {
      const { data: sent, error } = await supabase
        .from("messages")
        .insert({
          conversation_id: id,
          sender_id: currentUserId,
          content: trimmed,
          ...(replyId ? { reply_to_message_id: replyId } : {}),
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
      setReplyingTo((current) => current?.id === replyId ? null : current);

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

      {pinnedMessage && (
        <View style={[styles.pinBanner, { backgroundColor: colors.surfaceContainerHigh, borderBottomColor: colors.outlineVariant }]}>
          <Ionicons name="pin" size={17} color={colors.tint} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.pinTitle, { color: colors.tint }]}>Pinned message</Text>
            <Text numberOfLines={1} style={{ color: colors.text }}>{pinnedMessage.text || "Shared message"}</Text>
          </View>
          <Pressable onPress={() => { void pinOrUnpin(pinnedMessage); }} accessibilityLabel="Unpin message" hitSlop={8}>
            <Ionicons name="close" size={20} color={colors.icon} />
          </Pressable>
        </View>
      )}

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
            <Animated.View
              style={{ transform: [{ translateX: swipeOffset }] }}
              {...swipeResponder.panHandlers}
            >
              {visibleMessages.map((m, index) => {
                const senderName =
                  conversationType === "group" ? m.senderName : undefined;

                const nextMessage = visibleMessages[index + 1];
                const showSenderAvatar = !m.fromMe && !!m.senderId && (
                  !nextMessage || nextMessage.senderId !== m.senderId ||
                  messageDay(nextMessage.createdAt) !== messageDay(m.createdAt)
                );

                const previous = visibleMessages[index - 1];
                const showDate = !previous || messageDay(previous.createdAt) !== messageDay(m.createdAt);
                const dateDivider = showDate ? (
                  <View style={styles.dateDivider}>
                    <Text style={[styles.dateLabel, { color: colors.icon, backgroundColor: colors.surfaceContainerHigh }]}>
                      {formatMessageDay(m.createdAt)}
                    </Text>
                  </View>
                ) : null;

                if (m.deletedForEveryone) {
                  return (
                    <Fragment key={m.id}>
                      {dateDivider}
                      <View style={[styles.deletedRow, { justifyContent: m.fromMe ? "flex-end" : "flex-start" }]}>
                        <Text style={[styles.deletedText, { color: colors.icon, borderColor: colors.outlineVariant }]}>This message was deleted</Text>
                      </View>
                    </Fragment>
                  );
                }

                if (m.type === "activity" && m.sharedActivity) {
                  return (
                    <Fragment key={m.id}>
                      {dateDivider}
                      <View style={styles.swipeMessageRow}>
                        <Text style={[styles.swipeTime, { color: colors.icon }]}>{m.time}</Text>
                        <SharedContentBubble
                          kind="activity"
                          fromMe={m.fromMe}
                          time={m.time}
                          showTime={false}
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
                      </View>
                    </Fragment>
                  );
                }

                if (m.type === "post" && m.sharedPost) {
                  return (
                    <Fragment key={m.id}>
                      {dateDivider}
                      <View style={styles.swipeMessageRow}>
                        <Text style={[styles.swipeTime, { color: colors.icon }]}>{m.time}</Text>
                        <SharedContentBubble
                          kind="post"
                          fromMe={m.fromMe}
                          time={m.time}
                          showTime={false}
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
                      </View>
                    </Fragment>
                  );
                }

                return (
                  <Fragment key={m.id}>
                    {dateDivider}
                    <View style={styles.swipeMessageRow}>
                      <Text style={[styles.swipeTime, { color: colors.icon }]}>{m.time}</Text>
                      <MessageBubble
                        text={m.text}
                        fromMe={m.fromMe}
                        time={m.time}
                        showTime={false}
                        senderName={senderName}
                        avatarUri={m.senderId ? senderAvatars[m.senderId] : undefined}
                        showAvatar={showSenderAvatar}
                        replyPreview={m.replyToMessageId ? (() => {
                          const target = messageById.get(m.replyToMessageId);
                          return {
                            senderName: target?.fromMe ? "You" : target?.senderName ?? "Rollin' User",
                            text: target?.deletedForEveryone ? "This message was deleted" : target?.text || (target?.type === "activity" ? "Shared an activity" : target?.type === "post" ? "Shared a post" : "Original message unavailable"),
                          };
                        })() : undefined}
                        onReply={() => setReplyingTo(m)}
                        onForward={() => beginForward(m)}
                        onPin={() => { void pinOrUnpin(m); }}
                        isPinned={pinnedId === m.id}
                        onDelete={() => confirmDeleteMessage(m)}
                        reactions={(() => {
                          const all = reactionsByMessage[m.id] ?? [];
                          return [...new Set(all.map((r) => r.emoji))].map((emoji) => ({
                            emoji,
                            count: all.filter((r) => r.emoji === emoji).length,
                            mine: all.some((r) => r.emoji === emoji && r.user_id === currentUserId),
                          }));
                        })()}
                        onReact={(emoji) => { void toggleReaction(m.id, emoji); }}
                        onPressSender={
                          !m.fromMe && m.senderId
                            ? () => router.push(`/profile/${m.senderId}`)
                            : undefined
                        }
                      />
                    </View>
                  </Fragment>
                );
              })}
            </Animated.View>
          </ScrollView>
        )}

        <Modal
          visible={!!forwardingMessage}
          transparent
          animationType="slide"
          onRequestClose={() => { if (!forwarding) setForwardingMessage(null); }}
        >
          <View style={styles.forwardBackdrop}>
            <View style={[styles.forwardSheet, { backgroundColor: colors.background }]}>
              <View style={[styles.forwardHeader, { borderBottomColor: colors.outlineVariant }]}>
                <Pressable onPress={() => { if (!forwarding) setForwardingMessage(null); }} disabled={forwarding} accessibilityRole="button">
                  <Text style={[styles.headerLink, { color: colors.tint }]}>Done</Text>
                </Pressable>
                <Text style={[styles.forwardTitle, { color: colors.text }]}>Send to</Text>
                <Pressable onPress={() => Alert.alert("Create group", "Group creation from forwarding isn't available yet.")} accessibilityRole="button">
                  <Text style={[styles.headerLink, { color: colors.tint }]}>Create group</Text>
                </Pressable>
              </View>
              <View style={[styles.forwardSearch, { backgroundColor: colors.surfaceContainerHigh }]}>
                <Ionicons name="search" size={20} color={colors.icon} />
                <TextInput
                  value={forwardQuery}
                  onChangeText={setForwardQuery}
                  placeholder="Search"
                  placeholderTextColor={colors.icon}
                  style={[styles.forwardSearchInput, { color: colors.text }]}
                  autoCorrect={false}
                  autoCapitalize="none"
                  accessibilityLabel="Search conversations to forward to"
                />
                {forwardQuery.length > 0 && (
                  <Pressable onPress={() => setForwardQuery("")} accessibilityLabel="Clear search">
                    <Ionicons name="close-circle" size={19} color={colors.icon} />
                  </Pressable>
                )}
              </View>
              <ScrollView style={styles.forwardList} contentContainerStyle={{ paddingBottom: 30 }} keyboardShouldPersistTaps="handled">
                {filteredForwardConversations.map((conversation) => {
                  const sent = forwardedTo.includes(conversation.id);
                  const busy = forwardingTo === conversation.id;
                  return (
                    <View key={conversation.id} style={[styles.forwardTarget, { borderBottomColor: colors.outlineVariant }]}>
                      {conversation.avatarUri ? (
                        <Image source={{ uri: conversation.avatarUri }} style={styles.forwardAvatar} />
                      ) : (
                        <View style={[styles.forwardAvatar, styles.forwardAvatarFallback, { backgroundColor: colors.surfaceContainerHigh }]}>
                          <Ionicons name="people" size={24} color={colors.icon} />
                        </View>
                      )}
                      <Text numberOfLines={1} style={[styles.forwardName, { color: colors.text }]}>{conversation.title}</Text>
                      <Pressable
                        disabled={forwarding || sent}
                        onPress={() => { void forwardTo(conversation.id); }}
                        accessibilityRole="button"
                        accessibilityLabel={`Send forwarded message to ${conversation.title}`}
                        style={[styles.forwardSend, { backgroundColor: sent ? colors.surfaceContainerHigh : colors.tint }]}
                      >
                        {busy ? <ActivityIndicator color={colors.onPrimary} size="small" /> : (
                          <Text style={{ fontWeight: "700", color: sent ? colors.icon : colors.onPrimary }}>{sent ? "Sent" : "Send"}</Text>
                        )}
                      </Pressable>
                    </View>
                  );
                })}
                {filteredForwardConversations.length === 0 && (
                  <Text style={{ color: colors.icon, padding: 22, textAlign: "center" }}>No matching conversations</Text>
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>

        <MessageInput
          value={input}
          onChangeText={setInput}
          onSend={send}
          replyingTo={replyingTo ? {
            senderName: replyingTo.fromMe ? "yourself" : replyingTo.senderName ?? headerName ?? name ?? "user",
            text: replyingTo.text || (replyingTo.type === "activity" ? "Shared an activity" : "Shared a post"),
          } : null}
          onCancelReply={() => setReplyingTo(null)}
        />
      </KeyboardAvoidingView>
    </AppView>
  );
}
const styles = StyleSheet.create({
  pinBanner: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth },
  pinTitle: { fontSize: 12, fontWeight: "700", marginBottom: 2 },
  deletedRow: { flexDirection: "row", paddingHorizontal: 15, marginTop: 10 },
  deletedText: { fontSize: 13, fontStyle: "italic", padding: 12, borderRadius: 16, borderWidth: 1 },
  forwardBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" },
  forwardSheet: { height: "91%", borderTopLeftRadius: 22, borderTopRightRadius: 22, overflow: "hidden" },
  forwardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 17, paddingTop: 20, paddingBottom: 18, borderBottomWidth: StyleSheet.hairlineWidth },
  forwardTitle: { fontSize: 19, fontWeight: "700" },
  headerLink: { fontSize: 15, fontWeight: "600" },
  forwardSearch: { minHeight: 45, borderRadius: 13, marginHorizontal: 16, marginTop: 16, marginBottom: 9, paddingHorizontal: 13, flexDirection: "row", alignItems: "center", gap: 10 },
  forwardSearchInput: { flex: 1, paddingVertical: 10, fontSize: 16 },
  forwardList: { flex: 1, paddingHorizontal: 16 },
  forwardTarget: { flexDirection: "row", alignItems: "center", minHeight: 82, gap: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  forwardAvatar: { width: 52, height: 52, borderRadius: 26 },
  forwardAvatarFallback: { justifyContent: "center", alignItems: "center" },
  forwardName: { flex: 1, fontSize: 16, fontWeight: "600" },
  forwardSend: { minWidth: 67, height: 38, borderRadius: 12, justifyContent: "center", alignItems: "center", paddingHorizontal: 10 },
  swipeMessageRow: {
    width: "100%",
    position: "relative",
  },
  // Outside the right edge until the chat is swiped to the left.
  swipeTime: {
    position: "absolute",
    right: -73,
    top: 0,
    bottom: 0,
    width: 68,
    textAlign: "center",
    textAlignVertical: "center",
    fontSize: 10,
    fontWeight: "500",
  },
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
