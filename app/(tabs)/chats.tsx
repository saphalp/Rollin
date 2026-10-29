import { TourScrollView, TourTarget } from '@/components/tutorial/tour-target';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  StyleSheet,
  useColorScheme,
  View,
} from "react-native";

import ChatCards from "@/components/chats/ChatCards";
import { AppView } from "@/components/view";
import { Colors, Fonts } from "@/constants/theme";
import { useConversations } from "@/hooks/use-conversations";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { Text } from "react-native-paper";

export default function ChatsScreen() {
  const theme = useColorScheme() ?? "light";
  const colors = Colors[theme];
  const { activeConversations, archivedConversations, loading, refresh, formatTime, deleteConversation } = useConversations();
  const [refreshing, setRefreshing] = useState(false);
  const hasFocused = useRef(false);

  // useConversations already loads on mount. Refresh only when returning to Chats.
  useFocusEffect(useCallback(() => {
    if (!hasFocused.current) {
      hasFocused.current = true;
      return;
    }
    void refresh();
  }, [refresh]));

  async function onRefresh() {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }

  function confirmDelete(conversationId: string) {
    Alert.alert(
      "Delete conversation",
      "This will delete the conversation for you only.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => void deleteConversation(conversationId),
        },
      ],
    );
  }

  return (
    <AppView style={styles.container}>
      <TourScrollView
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <TourTarget id="chat-heading"><View style={styles.titleRow}>
          <Text style={[styles.title, { color: colors.text, fontFamily: Fonts.sans }]}>
            Messages
          </Text>
          {archivedConversations.length > 0 && (
            <Pressable
              onPress={() => router.push("/archived-chats")}
              style={styles.archivedButton}
              accessibilityRole="button"
              accessibilityLabel="View archived chats"
            >
              <Ionicons name="archive-outline" size={14} color={colors.tint} />
              <Text style={[styles.archivedButtonLabel, { color: colors.tint, fontFamily: Fonts.sans }]}>
                Archived
              </Text>
            </Pressable>
          )}
        </View></TourTarget>

        {loading ? (
          <ActivityIndicator color={colors.tint} style={styles.loader} />
        ) : activeConversations.length === 0 ? (
          <Text style={[styles.empty, { color: colors.icon, fontFamily: Fonts.sans }]}>
            No conversations yet. Follow someone to message them, or join an
            activity to join its group chat.
          </Text>
        ) : (
          <View style={styles.list}>
            {activeConversations.map((conversation, index) => (
              <View key={conversation.id}>
                <ChatCards
                  user={conversation.title}
                  avatar={{ uri: conversation.avatarUri }}
                  last_message={conversation.lastMessage}
                  is_read={conversation.isRead}
                  time={
                    conversation.lastMessageAt
                      ? formatTime(conversation.lastMessageAt)
                      : ""
                  }
                  onPress={() =>
                    router.push({
                      pathname: "/chat/[id]",
                      params: {
                        id: conversation.id,
                        name: conversation.title,
                        avatar: conversation.avatarUri,
                        otherUserId: conversation.otherUserId ?? "",
                      },
                    })
                  }
                  onLongPress={() => confirmDelete(conversation.id)}
                />
                {index < activeConversations.length - 1 && (
                  <View style={[styles.divider, { backgroundColor: colors.outlineVariant }]} />
                )}
              </View>
            ))}
          </View>
        )}
      </TourScrollView>
    </AppView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 32,
    gap: 12,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: -0.4,
  },
  loader: {
    marginTop: 40,
  },
  empty: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 24,
  },
  list: {
    gap: 0,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 66,
  },
  archivedButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  archivedButtonLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
});
