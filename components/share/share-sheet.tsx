import { Image } from "expo-image";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
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
import { useColorScheme } from "@/hooks/use-color-scheme";
import { FollowedUser, useFollowedUsers } from "@/hooks/use-followed-users";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const SCREEN_HEIGHT = Dimensions.get("window").height;

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function ShareSheet({ visible, onClose }: Props) {
  const theme = useColorScheme() ?? "light";
  const colors = Colors[theme];

  const { users, loading } = useFollowedUsers(visible);
  const [searchQuery, setSearchQuery] = useState("");

  const [modalVisible, setModalVisible] = useState(visible);
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

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

  function renderUser({ item }: { item: FollowedUser }) {
    const initials = item.fullName
      .trim()
      .split(" ")
      .map((word) => word[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();

    return (
      <TouchableOpacity style={styles.userItem} activeOpacity={0.7}>
        {item.avatarUri ? (
          <Image
            source={{ uri: item.avatarUri }}
            style={styles.avatar}
            contentFit="cover"
          />
        ) : (
          <View
            style={[
              styles.avatar,
              styles.avatarInitials,
              { backgroundColor: colors.tint },
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

  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginBottom: 6,
  },

  avatarInitials: {
    alignItems: "center",
    justifyContent: "center",
  },

  avatarInitialsText: {
    fontSize: 18,
    fontWeight: "700",
  },

  userName: {
    fontSize: 12,
    textAlign: "center",
  },
});
