import { AppText } from "@/components/text";
import ChatCards from "@/components/chats/ChatCards";
import { ChatError } from '@/components/chats/chat-error';
import { Colors } from "@/constants/theme";
import { useConversations } from "@/hooks/use-conversations";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { router } from "expo-router";
import { Alert, ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BackButton } from "@/components/ui/back-button";

export default function ArchivedChatsScreen() {
  const colors = Colors[useColorScheme() ?? "light"];
  const insets = useSafeAreaInsets();
  const { archivedConversations, loading, refreshing, error, refresh, formatTime, deleteConversation } = useConversations();

  function confirmDelete(conversationId: string) {
    Alert.alert(
      "Delete conversation",
      "This will delete the conversation for you only.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => { void deleteConversation(conversationId).catch(error => Alert.alert('Could not delete conversation', error.message)); },
        },
      ],
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <BackButton fallbackHref="/(tabs)/chats" />
        <AppText style={styles.title}>Archived</AppText>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing && !loading} onRefresh={refresh} />}
      >
        <ChatError message={error} onRetry={refresh} />
        {loading ? (
          <ActivityIndicator color={colors.tint} style={styles.loader} />
        ) : archivedConversations.length === 0 && !error ? (
          <AppText style={[styles.empty, { color: colors.icon }]}>
            No archived chats. Group chats are archived automatically when their activity ends.
          </AppText>
        ) : (
          <View style={styles.list}>
            {archivedConversations.map((conversation, index) => (
              <View key={conversation.id}>
                <ChatCards
                  user={conversation.title}
                  avatar={{ uri: conversation.avatarUri }}
                  last_message={conversation.lastMessage}
                  is_read={conversation.unreadCount === 0}
                  unreadCount={conversation.unreadCount}
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
                {index < archivedConversations.length - 1 && (
                  <View style={[styles.divider, { backgroundColor: colors.outlineVariant }]} />
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
  },
  content: {
    paddingHorizontal: 20,
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
    height: 1,
    marginLeft: 66,
  },
});
