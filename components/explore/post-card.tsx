import { Image } from "expo-image";
import { router } from "expo-router";
import { StyleSheet, TouchableOpacity, View } from "react-native";

import { AppText } from "@/components/text";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors, Fonts } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { usePostLike } from "@/hooks/use-post-like";

export type PostViewModel = {
  id: string;
  userId: string;
  userName: string;
  avatarUrl: string;
  createdAt: string;
  activityId: string;
  activityTitle: string;
  caption: string | null;
  imageUrl: string;
  likeCount: number;
  likedByMe: boolean;
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  return `${days}d ago`;
}

type Props = {
  post: PostViewModel;
  isOwnPost?: boolean;
  onDelete?: (postId: string) => void;
};

export function PostCard({ post, isOwnPost, onDelete }: Props) {
  const theme = useColorScheme() ?? "light";
  const colors = Colors[theme];
  const { liked, count, toggle } = usePostLike(
    post.id,
    post.likedByMe,
    post.likeCount,
  );

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.cardBackground, borderColor: colors.outlineVariant },
      ]}
    >
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerLeft}
          activeOpacity={0.8}
          onPress={() => router.push(`/profile/${post.userId}`)}
        >
          <Image
            source={{ uri: post.avatarUrl }}
            style={styles.avatar}
            contentFit="cover"
          />
          <View>
            <AppText
              style={[styles.userName, { color: colors.text, fontFamily: Fonts?.sans }]}
            >
              {post.userName}
            </AppText>
            <AppText
              style={[styles.timePosted, { color: colors.outline, fontFamily: Fonts?.sans }]}
            >
              {timeAgo(post.createdAt)}
            </AppText>
          </View>
        </TouchableOpacity>

        {isOwnPost && (
          <TouchableOpacity
            onPress={() => onDelete?.(post.id)}
            hitSlop={8}
          >
            <IconSymbol name="ellipsis" size={20} color={colors.outline} />
          </TouchableOpacity>
        )}
      </View>

      {post.caption ? (
        <AppText style={[styles.caption, { color: colors.text, fontFamily: Fonts?.sans }]}>
          {post.caption}
        </AppText>
      ) : null}

      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => router.push(`/activity/${post.activityId}`)}
        style={[
          styles.eventTag,
          { backgroundColor: colors.secondaryContainer },
        ]}
      >
        <IconSymbol name="mappin" size={12} color={colors.onSecondaryContainer} />
        <AppText
          style={[
            styles.eventTagText,
            { color: colors.onSecondaryContainer, fontFamily: Fonts?.sans },
          ]}
          numberOfLines={1}
        >
          {post.activityTitle}
        </AppText>
      </TouchableOpacity>

      <Image
        source={{ uri: post.imageUrl }}
        style={styles.photo}
        contentFit="cover"
        cachePolicy="memory-disk"
      />

      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.likeButton} onPress={toggle} hitSlop={8}>
          <IconSymbol
            name={liked ? "heart.fill" : "heart"}
            size={22}
            color={liked ? colors.tint : colors.icon}
          />
          <AppText
            style={[styles.likeCount, { color: colors.text, fontFamily: Fonts?.sans }]}
          >
            {count}
          </AppText>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 16,
    marginBottom: 16,
    padding: 12,
    gap: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  userName: {
    fontSize: 14,
    fontWeight: "700",
  },
  timePosted: {
    fontSize: 12,
    marginTop: 1,
  },
  eventTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    maxWidth: "80%",
  },
  eventTagText: {
    fontSize: 12,
    fontWeight: "600",
  },
  photo: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 10,
    backgroundColor: "#DDDDDD",
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  likeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  likeCount: {
    fontSize: 14,
    fontWeight: "600",
  },
  caption: {
    fontSize: 13,
    lineHeight: 18,
  },
});
