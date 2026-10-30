import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import ConversationHeader from "@/components/chats/ConversationHeader";
import { PostImageCarousel } from "@/components/explore/post-image-carousel";
import { OverflowMenu } from "@/components/report/overflow-menu";
import { ShareSheet } from "@/components/share/share-sheet";
import { AppText } from "@/components/text";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { AppView } from "@/components/view";
import { Colors, Fonts } from "@/constants/theme";
import { useAuthContext } from "@/hooks/use-auth-context";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { usePostLike } from "@/hooks/use-post-like";
import { subscribeAccountChanges } from "@/lib/account-center";
import { loadExplorePost } from "@/services/activity-posts-service";

type PostDetail = {
  id: string;
  userId: string;
  userName: string;
  avatarUrl: string;
  caption: string | null;
  createdAt: string;
  imageUrls: string[];
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

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useColorScheme() ?? "light";
  const colors = Colors[theme];
  const insets = useSafeAreaInsets();

  const [post, setPost] = useState<PostDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const userId = useAuthContext().claims?.sub;

  useFocusEffect(useCallback(() => {
    let active = true;
    let controller: AbortController | null = null;
    async function load() {
      controller?.abort();
      const request = new AbortController(); controller = request;
      setPost(null); setError(''); setLoading(true);
      try {
        const result = id && userId ? await loadExplorePost(id, request.signal) : null;
        if (active && !request.signal.aborted) setPost(result);
      } catch {
        if (active && !request.signal.aborted) setError('Could not load this post. Please try again.');
      } finally {
        if (active && !request.signal.aborted) setLoading(false);
      }
    }
    const refresh = () => { void load(); };
    refresh();
    const unsubscribe = subscribeAccountChanges(refresh);
    const app = AppState.addEventListener('change', state => {
      if (state === 'active') refresh();
      else { controller?.abort(); setPost(null); }
    });
    return () => { active = false; controller?.abort(); unsubscribe(); app.remove(); setPost(null); };
  // Retry reloads the focused post and its current permissions.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, userId, attempt]));

  if (loading) {
    return (
      <AppView style={[styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator color={colors.tint} />
      </AppView>
    );
  }

  if (!post) {
    return (
      <AppView style={[styles.centered, { paddingTop: insets.top }]}>
        <AppText accessibilityRole={error ? 'alert' : undefined} style={{ color: colors.text }}>
          {error || 'This post is unavailable or private.'}
        </AppText>
        {!!error && <TouchableOpacity accessibilityRole="button" onPress={() => setAttempt(value => value + 1)} style={{ padding: 16 }}>
          <AppText style={{ color: colors.tint }}>Retry</AppText>
        </TouchableOpacity>}
        <TouchableOpacity accessibilityRole="button" onPress={() => router.back()} style={{ padding: 16 }}>
          <AppText style={{ color: colors.tint }}>Go back</AppText>
        </TouchableOpacity>
      </AppView>
    );
  }

  return <PostDetailView post={post} />;
}

function PostDetailView({ post }: { post: PostDetail }) {
  const theme = useColorScheme() ?? "light";
  const colors = Colors[theme];
  const insets = useSafeAreaInsets();
  const { profile } = useAuthContext();
  const isOwnPost = profile?.id === post.userId;

  const { liked, count, toggle } = usePostLike(
    post.id,
    post.likedByMe,
    post.likeCount,
  );
  const [shareSheetVisible, setShareSheetVisible] = useState(false);

  return (
    <AppView style={styles.container}>
      <ConversationHeader
        name={post.userName}
        avatar={{ uri: post.avatarUrl }}
        subtitle={timeAgo(post.createdAt)}
        right={
          isOwnPost ? undefined : (
            <OverflowMenu
              iconSize={24}
              anchorStyle={styles.menuButton}
              report={{ type: "post", id: post.id }}
            />
          )
        }
      />

      <ScrollView
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
      >
        <PostImageCarousel
          imageUrls={post.imageUrls}
          style={styles.carousel}
        />

        <View style={styles.body}>
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.likeButton}
              onPress={toggle}
              hitSlop={8}
            >
              <IconSymbol
                name={liked ? "heart.fill" : "heart"}
                size={26}
                color={liked ? colors.tint : colors.icon}
              />
              <AppText
                style={[
                  styles.likeCount,
                  { color: colors.text, fontFamily: Fonts?.sans },
                ]}
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
                size={24}
                color={colors.icon}
              />
            </TouchableOpacity>
          </View>

          <AppText
            style={[
              styles.captionLine,
              { color: colors.text, fontFamily: Fonts?.sans },
            ]}
          >
            <AppText
              style={[
                styles.captionName,
                { color: colors.text, fontFamily: Fonts?.sans },
              ]}
            >
              {post.userName}{" "}
            </AppText>
            {post.caption ?? ""}
          </AppText>
        </View>
      </ScrollView>

      <ShareSheet
        visible={shareSheetVisible}
        onClose={() => setShareSheetVisible(false)}
        shareType="post"
        contentId={post.id}
      />
    </AppView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  carousel: {
    borderRadius: 0,
  },
  menuButton: {
    padding: 4,
  },
  body: {
    padding: 16,
    gap: 12,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  likeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  likeCount: {
    fontSize: 15,
    fontWeight: "600",
  },
  shareButton: {
    marginLeft: 18,
  },
  captionLine: {
    fontSize: 14,
    lineHeight: 20,
  },
  captionName: {
    fontWeight: "700",
  },
});
