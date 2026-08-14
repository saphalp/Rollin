import ConversationHeader from "@/components/chats/ConversationHeader";
import MessageBubble from "@/components/chats/MessageBubble";
import MessageInput from "@/components/chats/MessageInput";
import { AppView } from "@/components/view";
import { Colors } from "@/constants/theme";
import { useMessagesRealtime } from "@/hooks/use-messages-realtime";
import { supabase } from "@/lib/supabase";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  useColorScheme,
} from "react-native";

type Message = {
  id: string;
  text: string;
  fromMe: boolean;
  time: string;
  senderName?: string;
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

  useEffect(() => {
    if (id) load();
  }, [id]);

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
      .select("id, sender_id, content, created_at")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true });

    setMessages(
      (messageRows ?? []).map((m: any) => ({
        id: m.id,
        text: m.content,
        fromMe: m.sender_id === uid,
        time: formatTime(m.created_at),
        senderName: m.sender_id !== uid ? names[m.sender_id] : undefined,
      })),
    );

    setLoading(false);
  }

  useMessagesRealtime(id, (incoming) => {
    setMessages((prev) => {
      if (prev.some((m) => m.id === incoming.id)) return prev;
      return [
        ...prev,
        {
          id: incoming.id,
          text: incoming.content,
          fromMe: incoming.sender_id === currentUserId,
          time: formatTime(incoming.created_at),
          senderName:
            incoming.sender_id !== currentUserId
              ? participantNames[incoming.sender_id]
              : undefined,
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
            {messages.map((m) => (
              <MessageBubble
                key={m.id}
                text={m.text}
                fromMe={m.fromMe}
                time={m.time}
                senderName={conversationType === "group" ? m.senderName : undefined}
              />
            ))}
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
