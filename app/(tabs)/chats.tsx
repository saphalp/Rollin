import { TourScrollView, TourTarget } from '@/components/tutorial/tour-target';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  TextInput,
  useColorScheme,
  View,
} from "react-native";

import ChatCards from "@/components/chats/ChatCards";
import { ChatError } from '@/components/chats/chat-error';
import { AppView } from "@/components/view";
import { Colors, Fonts } from "@/constants/theme";
import { useConversations } from "@/hooks/use-conversations";
import { resolveAvatarUri } from "@/lib/profile/resolve-avatar-uri";
import { supabase } from "@/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Text } from "react-native-paper";

type FriendResult = { id: string; full_name: string | null; profile_picture: string | null };

export default function ChatsScreen() {
  const theme = useColorScheme() ?? "light";
  const colors = Colors[theme];
  const { activeConversations, archivedConversations, loading, refresh, formatTime, deleteConversation } = useConversations();
  const [refreshing, setRefreshing] = useState(false);
  const hasFocused = useRef(false);
  const [search, setSearch] = useState("");
  const [friends, setFriends] = useState<FriendResult[]>([]);
  const [searchingFriends, setSearchingFriends] = useState(false);
  const [friendSearchError, setFriendSearchError] = useState(false);
  const [openingFriendId, setOpeningFriendId] = useState<string | null>(null);
  const openingFriendRef = useRef(false);
  const searchTerm = search.trim();
  const filteredConversations = useMemo(() =>
    activeConversations.filter((conversation) =>
      conversation.title.toLocaleLowerCase().includes(searchTerm.toLocaleLowerCase()),
    ), [activeConversations, searchTerm]);

  // Look up discoverable people after the user pauses typing. Supabase RLS
  // determines which profiles this account is allowed to see.
  useEffect(() => {
    if (searchTerm.length < 2) {
      setFriends([]);
      setSearchingFriends(false);
      setFriendSearchError(false);
      return;
    }
    let cancelled = false;
    setSearchingFriends(true);
    setFriendSearchError(false);
    const timer = setTimeout(async () => {
      const safeTerm = searchTerm.replace(/[%,_]/g, "").trim();
      if (safeTerm.length < 2) {
        if (!cancelled) {
          setFriends([]);
          setSearchingFriends(false);
        }
        return;
      }
      const [profilesResult, authResult] = await Promise.all([
        supabase.from("profiles")
          .select("id, full_name, profile_picture")
          .ilike("full_name", `%${safeTerm}%`)
          .order("full_name", { ascending: true })
          .limit(15),
        supabase.auth.getUser(),
      ]);
      if (cancelled) return;
      if (profilesResult.error || authResult.error) {
        console.warn("[chats] friend search failed:", profilesResult.error ?? authResult.error);
        setFriendSearchError(true);
        setFriends([]);
      } else {
        setFriends((profilesResult.data ?? []).filter(
          (profile) => profile.id !== authResult.data.user?.id,
        ));
      }
      setSearchingFriends(false);
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchTerm]);

  // Existing direct conversations already appear above in search results.
  const existingOtherIds = useMemo(() => new Set(
    activeConversations.map((conversation) => conversation.otherUserId).filter(Boolean),
  ), [activeConversations]);
  const newFriends = friends.filter((friend) => !existingOtherIds.has(friend.id));

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

  // Reuse the same RPC as the Message button in components/profile/UserProfile.
  // Supabase returns an existing direct chat or creates it if necessary.
  async function openFriendChat(friend: FriendResult) {
    if (openingFriendRef.current) return;
    openingFriendRef.current = true;
    setOpeningFriendId(friend.id);

    try {
      const { data: conversationId, error } = await supabase.rpc(
        "get_or_create_direct_conversation",
        { other_user_id: friend.id },
      );
      if (error) throw error;
      if (!conversationId) throw new Error("Could not open this conversation.");

      router.push({
        pathname: "/chat/[id]",
        params: {
          id: conversationId,
          name: friend.full_name?.trim() || "Rollin' User",
          avatar: resolveAvatarUri(friend.profile_picture),
          otherUserId: friend.id,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message :
        (error && typeof error === "object" && "message" in error
          ? String(error.message) : "");
      const code = error && typeof error === "object" && "code" in error
        ? String(error.code) : "";

      if (code === "P0001" && message.includes("follow this user")) {
        Alert.alert(
          "Follow required",
          "You need to follow this person before you can message them.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "View profile", onPress: () => router.push(`/profile/${friend.id}`) },
          ],
        );
      } else {
        console.error("[chats] open friend conversation failed:", error);
        Alert.alert("Could not open chat", message || "Please try again.");
      }
    } finally {
      openingFriendRef.current = false;
      setOpeningFriendId(null);
    }
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
          onPress: () => { void deleteConversation(conversationId).catch(error => Alert.alert('Could not delete conversation', error.message)); },
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
        keyboardShouldPersistTaps="handled"
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

        <View style={[styles.searchBar, { backgroundColor: colors.surfaceContainerHigh, borderColor: colors.outlineVariant }]}>
          <Ionicons name="search-outline" size={20} color={colors.icon} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search friends or conversations"
            placeholderTextColor={colors.icon}
            style={[styles.searchInput, { color: colors.text, fontFamily: Fonts.sans }]}
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel="Search friends or conversations"
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch("")} accessibilityLabel="Clear search" hitSlop={10}>
              <Ionicons name="close-circle" size={20} color={colors.icon} />
            </Pressable>
          )}
        </View>

        {loading ? (
          <ActivityIndicator color={colors.tint} style={styles.loader} />
        ) : !searchTerm && activeConversations.length === 0 ? (
          <Text style={[styles.empty, { color: colors.icon, fontFamily: Fonts.sans }]}>
            No conversations yet. Follow someone to message them, or join an
            activity to join its group chat.
          </Text>
        ) : (
          <View style={styles.list}>
            {searchTerm.length > 0 && filteredConversations.length > 0 && (
              <Text style={[styles.sectionTitle, { color: colors.icon }]}>Conversations</Text>
            )}
            {filteredConversations.map((conversation, index) => (
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
                {index < filteredConversations.length - 1 && (
                  <View style={[styles.divider, { backgroundColor: colors.outlineVariant }]} />
                )}
              </View>
            ))}
            {searchTerm.length >= 2 && (
              <View style={styles.friendSection}>
                <Text style={[styles.sectionTitle, { color: colors.icon }]}>People on Roli</Text>
                {searchingFriends && <ActivityIndicator color={colors.tint} style={styles.searchSpinner} />}
                {friendSearchError && (
                  <Text style={[styles.empty, { color: colors.icon }]}>Couldn't search people. Please try again.</Text>
                )}
                {!searchingFriends && !friendSearchError && newFriends.map((friend) => (
                  <Pressable
                    key={friend.id}
                    style={styles.friendRow}
                    onPress={() => void openFriendChat(friend)}
                    disabled={openingFriendId !== null}
                    accessibilityRole="button"
                    accessibilityLabel={`Message ${friend.full_name ?? "user"}`}
                  >
                    <Image source={{ uri: resolveAvatarUri(friend.profile_picture) }} style={styles.friendAvatar} />
                    <View style={styles.friendText}>
                      <Text style={[styles.friendName, { color: colors.text, fontFamily: Fonts.sans }]}>
                        {friend.full_name?.trim() || "Rollin' User"}
                      </Text>
                      <Text style={{ color: colors.icon }}>Tap to message</Text>
                    </View>
                    {openingFriendId === friend.id
                      ? <ActivityIndicator color={colors.tint} size="small" />
                      : <Ionicons name="chatbubble-outline" size={20} color={colors.icon} />}
                  </Pressable>
                ))}
                {!searchingFriends && !friendSearchError && newFriends.length === 0 && (
                  <Text style={[styles.searchEmpty, { color: colors.icon }]}>No additional people found.</Text>
                )}
              </View>
            )}
            {searchTerm.length > 0 && searchTerm.length < 2 && filteredConversations.length === 0 && (
              <Text style={[styles.searchEmpty, { color: colors.icon }]}>Type at least 2 characters to find people.</Text>
            )}
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
  searchBar: {
    minHeight: 46,
    borderRadius: 23,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 4,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 10,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    marginTop: 6,
    marginBottom: 4,
  },
  friendSection: {
    marginTop: 8,
    gap: 6,
  },
  friendRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 7,
    gap: 12,
  },
  friendAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  friendText: {
    flex: 1,
    gap: 3,
  },
  friendName: {
    fontSize: 15,
    fontWeight: "600",
  },
  searchSpinner: {
    marginVertical: 12,
  },
  searchEmpty: {
    fontSize: 14,
    marginTop: 12,
  },
});
