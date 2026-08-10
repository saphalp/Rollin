import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  useColorScheme,
  View,
} from "react-native";

import ChatCards from "@/components/chats/ChatCards";
import { AppView } from "@/components/view";
import { Colors, Fonts } from "@/constants/theme";
import { useConversations } from "@/hooks/use-conversations";
import { router } from "expo-router";
import { useState } from "react";
import { Text } from "react-native-paper";

export default function ChatsScreen() {
  const theme = useColorScheme() ?? "light";
  const colors = Colors[theme];
  const { conversations, loading, refresh, formatTime } = useConversations();
  const [refreshing, setRefreshing] = useState(false);

  async function onRefresh() {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }

  return (
    <AppView style={styles.container}>
      <ScrollView
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.titleRow}>
          <Text
            style={[
              styles.title,
              { color: colors.text, fontFamily: Fonts.sans },
            ]}
          >
            Messages
          </Text>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.tint} style={styles.loader} />
        ) : conversations.length === 0 ? (
          <Text
            style={[styles.empty, { color: colors.icon, fontFamily: Fonts.sans }]}
          >
            No conversations yet. Follow someone to message them, or join an
            activity to join its group chat.
          </Text>
        ) : (
          <View style={styles.list}>
            {conversations.map((conversation, index) => (
              <View key={conversation.id}>
                <ChatCards
                  user={conversation.title}
                  avatar={{ uri: conversation.avatarUri }}
                  last_message={conversation.lastMessage}
                  is_read
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
                      },
                    })
                  }
                />
                {index < conversations.length - 1 && (
                  <View
                    style={[
                      styles.divider,
                      { backgroundColor: colors.outlineVariant },
                    ]}
                  />
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
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
});
