import { Colors } from "@/constants/theme";
import { loadConversations, sendChatMessage, type ConversationSummary } from "@/services/messaging-service";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useColorScheme,
} from "react-native";

type ForwardSheetProps = {
  /** Text of the message being forwarded; null hides the sheet. */
  text: string | null;
  userId: string | null;
  onClose: () => void;
};

export default function ForwardSheet({ text, userId, onClose }: ForwardSheetProps) {
  const colors = Colors[useColorScheme() ?? "light"];
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [sentTo, setSentTo] = useState<string[]>([]);
  const [sendingTo, setSendingTo] = useState<string | null>(null);
  const sendingRef = useRef(false);
  const visible = text !== null;

  useEffect(() => {
    if (!visible) return;
    const controller = new AbortController();
    setQuery(""); setSentTo([]); setLoading(true);
    loadConversations(controller.signal)
      .then(rows => setConversations(rows.filter(row => !row.isArchived)))
      .catch(error => { if (!controller.signal.aborted) Alert.alert("Could not load conversations", error.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [visible]);

  async function forwardTo(conversationId: string) {
    if (text === null || !userId || sendingRef.current || sentTo.includes(conversationId)) return;
    sendingRef.current = true;
    setSendingTo(conversationId);
    try {
      // Forwarding sends a new message; the original stays unchanged.
      await sendChatMessage(conversationId, userId, `Forwarded message\n${text}`);
      setSentTo(previous => [...previous, conversationId]);
    } catch (error) {
      Alert.alert("Could not forward", error instanceof Error ? error.message : "Please try again.");
    } finally {
      sendingRef.current = false;
      setSendingTo(null);
    }
  }

  const term = query.trim().toLocaleLowerCase();
  const filtered = conversations.filter(conversation => conversation.title.toLocaleLowerCase().includes(term));

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => { if (!sendingTo) onClose(); }}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: colors.background }]}>
          <View style={[styles.header, { borderBottomColor: colors.outlineVariant }]}>
            <Text style={[styles.title, { color: colors.text }]}>Send to</Text>
            <Pressable onPress={onClose} disabled={!!sendingTo} accessibilityRole="button" style={styles.done}>
              <Text style={[styles.link, { color: colors.tint }]}>Done</Text>
            </Pressable>
          </View>
          <View style={[styles.search, { backgroundColor: colors.surfaceContainerHigh }]}>
            <Ionicons name="search" size={20} color={colors.icon} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search"
              placeholderTextColor={colors.icon}
              style={[styles.searchInput, { color: colors.text }]}
              autoCorrect={false}
              autoCapitalize="none"
              accessibilityLabel="Search conversations to forward to"
            />
            {query.length > 0 && (
              <Pressable onPress={() => setQuery("")} accessibilityLabel="Clear search">
                <Ionicons name="close-circle" size={19} color={colors.icon} />
              </Pressable>
            )}
          </View>
          <ScrollView style={styles.list} contentContainerStyle={{ paddingBottom: 30 }} keyboardShouldPersistTaps="handled">
            {loading && <ActivityIndicator color={colors.tint} style={{ padding: 22 }} />}
            {filtered.map(conversation => {
              const sent = sentTo.includes(conversation.id);
              return (
                <View key={conversation.id} style={[styles.target, { borderBottomColor: colors.outlineVariant }]}>
                  {conversation.avatarUri ? (
                    <Image source={{ uri: conversation.avatarUri }} style={styles.avatar} />
                  ) : (
                    <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: colors.surfaceContainerHigh }]}>
                      <Ionicons name="people" size={24} color={colors.icon} />
                    </View>
                  )}
                  <Text numberOfLines={1} style={[styles.name, { color: colors.text }]}>{conversation.title}</Text>
                  <Pressable
                    disabled={!!sendingTo || sent}
                    onPress={() => { void forwardTo(conversation.id); }}
                    accessibilityRole="button"
                    accessibilityLabel={`Send forwarded message to ${conversation.title}`}
                    style={[styles.send, { backgroundColor: sent ? colors.surfaceContainerHigh : colors.tint }]}
                  >
                    {sendingTo === conversation.id ? <ActivityIndicator color={colors.onPrimary} size="small" /> : (
                      <Text style={{ fontWeight: "700", color: sent ? colors.icon : colors.onPrimary }}>{sent ? "Sent" : "Send"}</Text>
                    )}
                  </Pressable>
                </View>
              );
            })}
            {!loading && filtered.length === 0 && (
              <Text style={{ color: colors.icon, padding: 22, textAlign: "center" }}>No matching conversations</Text>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" },
  sheet: { height: "91%", borderTopLeftRadius: 22, borderTopRightRadius: 22, overflow: "hidden" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingHorizontal: 17, paddingTop: 20, paddingBottom: 18, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { fontSize: 19, fontWeight: "700" },
  done: { position: "absolute", right: 17, top: 20 },
  link: { fontSize: 15, fontWeight: "600" },
  search: { minHeight: 45, borderRadius: 13, marginHorizontal: 16, marginTop: 16, marginBottom: 9, paddingHorizontal: 13, flexDirection: "row", alignItems: "center", gap: 10 },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 16 },
  list: { flex: 1, paddingHorizontal: 16 },
  target: { flexDirection: "row", alignItems: "center", minHeight: 82, gap: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  avatar: { width: 52, height: 52, borderRadius: 26 },
  avatarFallback: { justifyContent: "center", alignItems: "center" },
  name: { flex: 1, fontSize: 16, fontWeight: "600" },
  send: { minWidth: 67, height: 38, borderRadius: 12, justifyContent: "center", alignItems: "center", paddingHorizontal: 10 },
});
