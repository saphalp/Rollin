import { Image } from "expo-image";
import { router } from "expo-router";
import { useCallback, useState } from "react";
import {
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";

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

/**
 * Formats post timestamp:
 * - Seconds (< 1m): "Xs ago" (e.g., "5s ago", "45s ago")
 * - Minutes (< 1h): "Xm ago" (e.g., "5m ago")
 * - Hours (< 24h): "Xh ago" (e.g., "2h ago")
 * - 1 to 6 days: "1d ago", "2d ago", ... "6d ago"
 * - Older than 6 days:
 *   - Current year: M/D (e.g., 11/4, 3/16)
 *   - Prior years: M/D/YYYY (e.g., 11/4/2025, 3/16/2024)
 * No leading zeros.
 */
export function formatPostDate(dateStr: string): string {
  const timestamp = new Date(dateStr).getTime();
  if (Number.isNaN(timestamp)) return "";

  const diff = Date.now() - timestamp;
  const secs = Math.max(1, Math.floor(diff / 1000));
  if (secs < 60) return `${secs}s ago`;

  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;

  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days <= 6) {
    return `${days}d ago`;
  }

  const date = new Date(timestamp);
  const postYear = date.getFullYear();
  const currentYear = new Date().getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();

  if (postYear === currentYear) {
    return `${month}/${day}`;
  }
  return `${month}/${day}/${postYear}`;
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

  // Expandable caption state
  const [isExpanded, setIsExpanded] = useState(false);
  const [canExpand, setCanExpand] = useState(false);

  const handleTextLayout = useCallback((e: any) => {
    if (e.nativeEvent?.lines && e.nativeEvent.lines.length > 2) {
      setCanExpand(true);
    }
  }, []);

  const isLongCaption =
    post.caption != null &&
    (post.caption.length > 80 || post.caption.includes("\n"));

  const handlePhotoPress = (index: number) => {
    setSelectedPhotoIndex(index);
    setViewerVisible(true);
  };

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
      {/* Header: Avatar, Username + Activity Badge, Timestamp, and Menu */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
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
          </TouchableOpacity>

          <View style={styles.authorMeta}>
            <View style={styles.authorRow}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => router.push(`/profile/${post.userId}`)}
                accessibilityRole="button"
                accessibilityLabel={`View ${post.userName}'s profile`}
              >
                <AppText
                  style={[styles.userName, { color: colors.text, fontFamily: Fonts?.sans }]}
                  numberOfLines={1}
                >
                  {post.userName}
                </AppText>
              </TouchableOpacity>

              {/* Activity badge placed next to username */}
              {post.activityTitle ? (
                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={() => router.push(`/activity/${post.activityId}`)}
                  accessibilityRole="button"
                  accessibilityLabel={`View activity: ${post.activityTitle}`}
                  style={[
                    styles.activityBadge,
                    { backgroundColor: colors.secondaryContainer },
                  ]}
                >
                  <IconSymbol
                    name="mappin"
                    size={10.5}
                    color={colors.onSecondaryContainer}
                  />
                  <AppText
                    style={[
                      styles.activityBadgeText,
                      { color: colors.onSecondaryContainer, fontFamily: Fonts?.sans },
                    ]}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {post.activityTitle}
                  </AppText>
                </TouchableOpacity>
              ) : null}
            </View>

            {/* Timestamp */}
            <AppText
              style={[styles.timePosted, { color: colors.outline, fontFamily: Fonts?.sans }]}
            >
              {formatPostDate(post.createdAt)}
            </AppText>
          </View>
        </View>

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

      {/* Caption (if present) with max 2 lines default and See more / See less */}
      {post.caption ? (
        <View style={styles.captionContainer}>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => router.push(`/post/${post.id}`)}
          >
            <AppText
              style={[styles.caption, { color: colors.text, fontFamily: Fonts?.sans }]}
              numberOfLines={isExpanded ? undefined : 2}
              onTextLayout={handleTextLayout}
            >
              {post.caption}
            </AppText>
          </TouchableOpacity>

          {(canExpand || isLongCaption) && (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setIsExpanded((prev) => !prev)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel={isExpanded ? "Show less caption" : "Show more caption"}
              style={styles.expandButton}
            >
              <AppText
                style={[
                  styles.expandText,
                  { color: colors.outline, fontFamily: Fonts?.sans },
                ]}
              >
                {isExpanded ? "See less" : "See more"}
              </AppText>
            </TouchableOpacity>
          )}
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
  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  userName: {
    fontSize: 14.5,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  activityBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3.5,
    borderRadius: 20,
    paddingHorizontal: 7.5,
    paddingVertical: 2.5,
    maxWidth: 160,
  },
  activityBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: -0.1,
  },
  timePosted: {
    fontSize: 11.5,
    marginTop: 2,
  },
  captionContainer: {
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  caption: {
    fontSize: 13.5,
    lineHeight: 19,
  },
  expandButton: {
    marginTop: 3,
    alignSelf: "flex-start",
  },
  expandText: {
    fontSize: 12,
    fontWeight: "600",
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
