import { Image } from "expo-image";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Easing,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { AppText } from "@/components/text";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors, Fonts } from "@/constants/theme";
import { useAuthContext } from "@/hooks/use-auth-context";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { FollowedUser, useFollowedUsers } from "@/hooks/use-followed-users";
import { supabase } from "@/lib/supabase";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const SCREEN_HEIGHT = Dimensions.get("window").height;

type Props = {
  visible: boolean;
  onClose: () => void;
  shareType: "activity" | "post";
  contentId: string;
};

export function ShareSheet({ visible, onClose, shareType, contentId }: Props) {
  const theme = useColorScheme() ?? "light";
  const colors = Colors[theme];

  const { claims } = useAuthContext();
  const currentUserId = claims?.sub as string | undefined;

  const { users, loading } = useFollowedUsers(visible);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);

  const [modalVisible, setModalVisible] = useState(visible);
  const [backdropOpacity] = useState(() => new Animated.Value(0));
  const [sheetTranslateY] = useState(() => new Animated.Value(SCREEN_HEIGHT));

  useEffect(() => {
    if (visible) {
      setModalVisible(true);

      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 220,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(sheetTranslateY, {
          toValue: 0,
          duration: 260,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 180,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(sheetTranslateY, {
          toValue: SCREEN_HEIGHT,
          duration: 220,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) {
          setModalVisible(false);
          setSearchQuery("");
          setSelectedIds(new Set());
        }
      });
    }
  }, [visible, backdropOpacity, sheetTranslateY]);

  const filteredUsers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return users;
    return users.filter((user) =>
      user.fullName.toLowerCase().includes(query),
    );
  }, [users, searchQuery]);

  async function handleSend() {
    if (selectedIds.size === 0 || !currentUserId || sending) return;

    setSending(true);

    const recipientIds = [...selectedIds];

    const results = await Promise.all(
      recipientIds.map(async (recipientId) => {
        const { data: conversationId, error: conversationError } =
          await supabase.rpc("get_or_create_direct_conversation", {
            other_user_id: recipientId,
          });

        if (conversationError || !conversationId) {
          console.error(
            "[share-sheet] get_or_create_direct_conversation failed:",
            conversationError,
          );
          return false;
        }

        const { error: messageError } = await supabase
          .from("messages")
          .insert({
            conversation_id: conversationId,
            sender_id: currentUserId,
            type: shareType,
            shared_activity_id: shareType === "activity" ? contentId : null,
            shared_post_id: shareType === "post" ? contentId : null,
          });

        if (messageError) {
          console.error("[share-sheet] message insert failed:", messageError);
        }

        return !messageError;
      }),
    );

    setSending(false);

    const failureCount = results.filter((ok) => !ok).length;

    if (failureCount > 0) {
      Alert.alert(
        "Some shares failed",
        `Sent to ${results.length - failureCount} of ${results.length} people.`,
      );
      return;
    }

    onClose();
  }

  function toggleSelected(userId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  }

  function renderUser({ item }: { item: FollowedUser }) {
    const initials = item.fullName
      .trim()
      .split(" ")
      .map((word) => word[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();

    const isSelected = selectedIds.has(item.id);

    return (
      <TouchableOpacity
        style={styles.userItem}
        activeOpacity={0.7}
        onPress={() => toggleSelected(item.id)}
      >
        <View style={styles.avatarWrap}>
          {item.avatarUri ? (
            <Image
              source={{ uri: item.avatarUri }}
              style={[
                styles.avatar,
                isSelected && {
                  borderWidth: 2,
                  borderColor: colors.tint,
                },
              ]}
              contentFit="cover"
            />
          ) : (
            <View
              style={[
                styles.avatar,
                styles.avatarInitials,
                { backgroundColor: colors.tint },
                isSelected && {
                  borderWidth: 2,
                  borderColor: colors.tint,
                },
              ]}
            >
              <AppText
                style={[
                  styles.avatarInitialsText,
                  {
                    color: colors.onImageOverlay,
                    fontFamily: Fonts?.sans,
                  },
                ]}
              >
                {initials}
              </AppText>
            </View>
          )}

          {isSelected && (
            <View
              style={[
                styles.checkBadge,
                {
                  backgroundColor: colors.tint,
                  borderColor: colors.background,
                },
              ]}
            >
              <IconSymbol
                name="checkmark"
                size={11}
                color={colors.onPrimary}
              />
            </View>
          )}
        </View>

        <AppText
          numberOfLines={1}
          style={[
            styles.userName,
            { color: colors.text, fontFamily: Fonts?.sans },
          ]}
        >
          {item.fullName}
        </AppText>
      </TouchableOpacity>
    );
  }

  return (
    <Modal
      visible={modalVisible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <AnimatedPressable
          style={[styles.backdrop, { opacity: backdropOpacity }]}
          onPress={onClose}
        />

        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.background,
              transform: [{ translateY: sheetTranslateY }],
            },
          ]}
        >
          <View
            style={[
              styles.handle,
              { backgroundColor: colors.outlineVariant },
            ]}
          />

          <View
            style={[
              styles.searchBar,
              {
                backgroundColor: colors.surfaceContainerHigh,
                borderColor: colors.outlineVariant,
              },
            ]}
          >
            <IconSymbol
              name="magnifyingglass"
              size={18}
              color={colors.outline}
            />

            <TextInput
              placeholder="Search user"
              placeholderTextColor={colors.outline}
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={[
                styles.searchInput,
                { color: colors.text, fontFamily: Fonts?.sans },
              ]}
            />
          </View>

          <View style={styles.listContainer}>
            {loading ? (
              <ActivityIndicator
                color={colors.tint}
                style={styles.loader}
              />
            ) : filteredUsers.length === 0 ? (
              <AppText
                style={[
                  styles.emptyText,
                  { color: colors.outline, fontFamily: Fonts?.sans },
                ]}
              >
                {users.length === 0
                  ? "You're not following anyone yet."
                  : "No users match your search."}
              </AppText>
            ) : (
              <FlatList
                data={filteredUsers}
                keyExtractor={(item) => item.id}
                renderItem={renderUser}
                numColumns={4}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.userList}
              />
            )}
          </View>

          {selectedIds.size > 0 && (
            <TouchableOpacity
              style={[
                styles.sendButton,
                {
                  backgroundColor: colors.tint,
                  opacity: sending ? 0.7 : 1,
                },
              ]}
              activeOpacity={0.85}
              onPress={handleSend}
              disabled={sending}
            >
              {sending ? (
                <ActivityIndicator color={colors.onPrimary} />
              ) : (
                <AppText
                  style={[
                    styles.sendButtonText,
                    { color: colors.onPrimary, fontFamily: Fonts?.sans },
                  ]}
                >
                  Send{selectedIds.size > 1 ? ` (${selectedIds.size})` : ""}
                </AppText>
              )}
            </TouchableOpacity>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "flex-end",
  },

  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.25)",
  },

  sheet: {
    height: "65%",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 24,
  },

  handle: {
    width: 42,
    height: 4,
    borderRadius: 3,
    alignSelf: "center",
    marginBottom: 16,
  },

  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 44,
    marginBottom: 16,
  },

  searchInput: {
    flex: 1,
    fontSize: 15,
    padding: 0,
  },

  listContainer: {
    flex: 1,
  },

  loader: {
    marginTop: 40,
  },

  emptyText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    marginTop: 40,
  },

  userList: {
    paddingBottom: 20,
  },

  userItem: {
    flex: 1 / 4,
    alignItems: "center",
    marginBottom: 20,
    paddingHorizontal: 4,
  },

  avatarWrap: {
    position: "relative",
    marginBottom: 6,
  },

  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },

  avatarInitials: {
    alignItems: "center",
    justifyContent: "center",
  },

  avatarInitialsText: {
    fontSize: 18,
    fontWeight: "700",
  },

  checkBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },

  userName: {
    fontSize: 12,
    textAlign: "center",
  },

  sendButton: {
    minHeight: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },

  sendButtonText: {
    fontSize: 15,
    fontWeight: "700",
  },
});
