import { Image } from "expo-image";
import { router } from "expo-router";
import { useState } from "react";
import {
  FlatList,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";

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

function PostImageCarousel({ imageUrls }: { imageUrls: string[] }) {
  const [width, setWidth] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);

  function onLayout(e: LayoutChangeEvent) {
    setWidth(e.nativeEvent.layout.width);
  }

  function onScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    if (!width) return;
    const index = Math.round(e.nativeEvent.contentOffset.x / width);
    setActiveIndex(index);
  }

  if (imageUrls.length <= 1) {
    return (
      <Image
        source={{ uri: imageUrls[0] }}
        style={styles.photo}
        contentFit="cover"
        cachePolicy="memory-disk"
      />
    );
  }

  return (
    <View style={styles.photo} onLayout={onLayout}>
      {width > 0 && (
        <FlatList
          data={imageUrls}
          keyExtractor={(uri, index) => `${uri}-${index}`}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
          renderItem={({ item }) => (
            <Image
              source={{ uri: item }}
              style={{ width, height: width }}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
          )}
        />
      )}

      <View style={styles.imageCountBadge}>
        <AppText style={styles.imageCountBadgeText}>
          {activeIndex + 1}/{imageUrls.length}
        </AppText>
      </View>

      <View style={styles.dotsRow}>
        {imageUrls.map((_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              {
                backgroundColor:
                  index === activeIndex ? "#FFFFFF" : "rgba(255,255,255,0.5)",
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

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
  const [shareSheetVisible, setShareSheetVisible] = useState(false);

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

      <PostImageCarousel imageUrls={post.imageUrls} />

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

        <TouchableOpacity
          style={styles.shareButton}
          hitSlop={8}
          onPress={() => setShareSheetVisible(true)}
        >
          <IconSymbol
            name="square.and.arrow.up"
            size={20}
            color={colors.icon}
          />
        </TouchableOpacity>
      </View>

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
    overflow: "hidden",
  },
  imageCountBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 12,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  imageCountBadgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "600",
  },
  dotsRow: {
    position: "absolute",
    bottom: 10,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
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
  shareButton: {
    marginLeft: 14,
  },
  caption: {
    fontSize: 13,
    lineHeight: 18,
  },
});
