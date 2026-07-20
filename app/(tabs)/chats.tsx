import { ScrollView, StyleSheet, useColorScheme, View } from "react-native";

import ChatCards from "@/components/chats/ChatCards";
import { AppView } from "@/components/view";
import { Colors, Fonts } from "@/constants/theme";
import { Text } from "react-native-paper";

const DUMMY_CHATS = [
  {
    id: "1",
    user: "K. Prather",
    avatar: { uri: "https://i.pravatar.cc/150?img=12" },
    last_message: "Sounds good, see you Saturday at 7!",
    is_read: false,
    time: "9:42 AM",
  },
  {
    id: "2",
    user: "Maya Chen",
    avatar: { uri: "https://i.pravatar.cc/150?img=32" },
    last_message: "I'll bring the board games 🎲",
    is_read: false,
    time: "8:15 AM",
  },
  {
    id: "3",
    user: "Devon Alvarez",
    avatar: { uri: "https://i.pravatar.cc/150?img=15" },
    last_message: "Can you pick me up on the way?",
    is_read: true,
    time: "Yesterday",
  },
  {
    id: "4",
    user: "Priya Sharma",
    avatar: { uri: "https://i.pravatar.cc/150?img=47" },
    last_message: "Thanks for the ride!",
    is_read: true,
    time: "Yesterday",
  },
  {
    id: "5",
    user: "Jordan Miles",
    avatar: { uri: "https://i.pravatar.cc/150?img=8" },
    last_message: "Let me know if you can make it",
    is_read: true,
    time: "Mon",
  },
  {
    id: "6",
    user: "Rina Patel",
    avatar: { uri: "https://i.pravatar.cc/150?img=25" },
    last_message: "The hike was amazing, we should do it again soon",
    is_read: true,
    time: "Mon",
  },
  {
    id: "7",
    user: "Ethan Wright",
    avatar: { uri: "https://i.pravatar.cc/150?img=17" },
    last_message: "Rescheduling to Friday works for me",
    is_read: true,
    time: "Sun",
  },
];

export default function ChatsScreen() {
  const theme = useColorScheme() ?? "light";
  const colors = Colors[theme];

  const unreadCount = DUMMY_CHATS.filter((c) => !c.is_read).length;

  return (
    <AppView style={styles.container}>
      <ScrollView
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
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
          {unreadCount > 0 && (
            <View
              style={[
                styles.unreadPill,
                { backgroundColor: colors.tint },
              ]}
            >
              <Text
                style={[
                  styles.unreadPillText,
                  { color: colors.onPrimary, fontFamily: Fonts.sans },
                ]}
              >
                {unreadCount} new
              </Text>
            </View>
          )}
        </View>

        <View style={styles.list}>
          {DUMMY_CHATS.map((chat, index) => (
            <View key={chat.id}>
              <ChatCards
                user={chat.user}
                avatar={chat.avatar}
                last_message={chat.last_message}
                is_read={chat.is_read}
                time={chat.time}
              />
              {index < DUMMY_CHATS.length - 1 && (
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
      </ScrollView>
    </AppView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 12,
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
  unreadPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  unreadPillText: {
    fontSize: 12,
    fontWeight: "700",
  },
  list: {
    gap: 0,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 66,
  },
});
