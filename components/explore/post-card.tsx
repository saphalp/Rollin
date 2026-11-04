import { Image } from "expo-image";
import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";

import { FullScreenImageViewer } from "@/components/explore/full-screen-image-viewer";
import { PostImageCarousel } from "@/components/explore/post-image-carousel";
import { OverflowMenu } from "@/components/report/overflow-menu";
import { ShareSheet } from "@/components/share/share-sheet";
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
  imageUrls: string[];
  likeCount: number;
  likedByMe: boolean;
};

function timeAgo(dateStr: string): string {
  const timestamp = new Date(dateStr).getTime();
  if (Number.isNaN(timestamp)) return "";
  const diff = Date.now() - timestamp;
  if (diff < 60000) return "Just now";
  const mins = Math.floor(diff / 60000);
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
  const isDark = theme === "dark";

  const { liked, count, toggle } = usePostLike(
    post.id,
    post.likedByMe,
    post.likeCount
  );

  const [shareSheetVisible, setShareSheetVisible] = useState(false);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);

  const handlePhotoPress = (index: number) => {
    setSelectedPhotoIndex(index);
    setViewerVisible(true);
  };

  // Rich warm amber styling with strong contrast for the compact activity tag
  const tagBg = isDark ? "rgba(254, 166, 25, 0.24)" : "#FEF3C7";
  const tagBorder = isDark ? "rgba(254, 166, 25, 0.45)" : "#FDE68A";
  const tagTextColor = isDark ? "#FDE68A" : "#92400E";
  const tagIconColor = isDark ? "#FBBF24" : "#D97706";

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.cardBackground,
          borderColor: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.06)",
        },
      ]}
    >
      {/* Header: Author info & overflow menu */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerLeft}
          activeOpacity={0.8}
          onPress={() => router.push(`/profile/${post.userId}`)}
          accessibilityRole="button"
          accessibilityLabel={`View ${post.userName}'s profile`}
        >
          <Image
            source={{ uri: post.avatarUrl }}
            style={styles.avatar}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
          <View style={styles.authorMeta}>
            <AppText
              style={[styles.userName, { color: colors.text, fontFamily: Fonts?.sans }]}
              numberOfLines={1}
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

        <OverflowMenu
          iconColor={colors.outline}
          items={
            isOwnPost && onDelete
              ? [
                  {
                    key: "delete",
                    title: "Delete Post",
                    icon: "trash-can-outline",
                    destructive: true,
                    onPress: () => onDelete(post.id),
                  },
                ]
              : []
          }
          report={isOwnPost ? undefined : { type: "post", id: post.id }}
        />
      </View>

      {/* Caption (if present) - taps to open post detail */}
      {post.caption ? (
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => router.push(`/post/${post.id}`)}
          style={styles.captionContainer}
        >
          <AppText
            style={[styles.caption, { color: colors.text, fontFamily: Fonts?.sans }]}
            numberOfLines={3}
          >
            {post.caption}
          </AppText>
        </TouchableOpacity>
      ) : null}

      {/* Compact Activity Tag */}
      {post.activityTitle ? (
        <View style={styles.tagRow}>
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={() => router.push(`/activity/${post.activityId}`)}
            accessibilityRole="button"
            accessibilityLabel={`View activity: ${post.activityTitle}`}
            style={[
              styles.activityTag,
              { backgroundColor: tagBg, borderColor: tagBorder },
            ]}
          >
            <IconSymbol name="mappin" size={11} color={tagIconColor} />
            <AppText
              style={[
                styles.activityTagText,
                { color: tagTextColor, fontFamily: Fonts?.sans },
              ]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {post.activityTitle}
            </AppText>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Photo carousel with full-screen tap */}
      <View style={styles.mediaContainer}>
        <PostImageCarousel
          imageUrls={post.imageUrls}
          onPressImage={handlePhotoPress}
        />
      </View>

      {/* Action Bar: Likes and Share */}
      <View style={styles.actionRow}>
        {/* Like button */}
        <TouchableOpacity
          style={styles.actionButton}
          onPress={toggle}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel={
            liked ? `Unlike post, ${count} likes` : `Like post, ${count} likes`
          }
        >
          <IconSymbol
            name={liked ? "heart.fill" : "heart"}
            size={22}
            color={liked ? (isDark ? "#F87171" : "#EF4444") : colors.icon}
          />
          <AppText
            style={[
              styles.actionCount,
              {
                color: liked ? (isDark ? "#F87171" : "#EF4444") : colors.text,
                fontFamily: Fonts?.sans,
              },
            ]}
          >
            {count}
          </AppText>
        </TouchableOpacity>

        {/* Share button */}
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => setShareSheetVisible(true)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel="Share post"
        >
          <IconSymbol
            name="square.and.arrow.up"
            size={20}
            color={colors.icon}
          />
        </TouchableOpacity>
      </View>

      {/* Full Screen Photo Viewer Modal */}
      <FullScreenImageViewer
        visible={viewerVisible}
        imageUrls={post.imageUrls}
        initialIndex={selectedPhotoIndex}
        onClose={() => setViewerVisible(false)}
      />

      {/* Share Sheet Modal */}
      <ShareSheet
        visible={shareSheetVisible}
        onClose={() => setShareSheetVisible(false)}
        shareType="post"
        contentId={post.id}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 14,
    marginBottom: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1.5 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(0,0,0,0.05)",
  },
  authorMeta: {
    flex: 1,
    justifyContent: "center",
  },
  userName: {
    fontSize: 14.5,
    fontWeight: "600",
    letterSpacing: -0.2,
  },
  timePosted: {
    fontSize: 11.5,
    marginTop: 1,
  },
  captionContainer: {
    paddingHorizontal: 12,
    paddingBottom: 6,
  },
  caption: {
    fontSize: 13.5,
    lineHeight: 19,
  },
  tagRow: {
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  activityTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4.5,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 9,
    paddingVertical: 4,
    maxWidth: "85%",
  },
  activityTagText: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: -0.1,
  },
  mediaContainer: {
    paddingHorizontal: 8,
    paddingBottom: 6,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 10,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    minHeight: 40,
    minWidth: 40,
    justifyContent: "center",
  },
  actionCount: {
    fontSize: 13,
    fontWeight: "600",
  },
});
