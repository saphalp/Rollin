import ConversationHeader from "@/components/chats/ConversationHeader";
import MessageBubble from "@/components/chats/MessageBubble";
import MessageInput from "@/components/chats/MessageInput";
import { AppView } from "@/components/view";
import { Colors } from "@/constants/theme";
import { useLocalSearchParams } from "expo-router";
import { useRef, useState } from "react";
import {
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
};

const INITIAL_MESSAGES: Message[] = [
  {
    id: "m1",
    text: "Hey! Are we still on for tonight?",
    fromMe: false,
    time: "9:32 AM",
  },
  {
    id: "m2",
    text: "Yes, 7pm works for me",
    fromMe: true,
    time: "9:35 AM",
  },
  {
    id: "m3",
    text: "Sounds good, see you Saturday at 7!",
    fromMe: false,
    time: "9:42 AM",
  },
];

function formatTime(date: Date) {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function ChatConversationScreen() {
  const { name, avatar } = useLocalSearchParams<{
    id: string;
    name?: string;
    avatar?: string;
  }>();

  const theme = useColorScheme() ?? "light";
  const colors = Colors[theme];

  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState("");
  const scrollRef = useRef<ScrollView>(null);

  function send() {
    const trimmed = input.trim();
    if (!trimmed) return;

    const newMessage: Message = {
      id: `m${Date.now()}`,
      text: trimmed,
      fromMe: true,
      time: formatTime(new Date()),
    };

    setMessages((prev) => [...prev, newMessage]);
    setInput("");
  }

  return (
    <AppView style={styles.container}>
      <ConversationHeader
        name={name ?? "Chat"}
        avatar={{ uri: avatar ?? "" }}
        subtitle="Active now"
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          ref={scrollRef}
          style={{ backgroundColor: colors.background }}
          contentContainerStyle={styles.messages}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() =>
            scrollRef.current?.scrollToEnd({ animated: true })
          }
        >
          {messages.map((m) => (
            <MessageBubble
              key={m.id}
              text={m.text}
              fromMe={m.fromMe}
              time={m.time}
            />
          ))}
        </ScrollView>

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
  messages: {
    paddingVertical: 12,
    gap: 4,
  },
});
