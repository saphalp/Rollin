import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import ConversationHeader from "@/components/chats/ConversationHeader";
import { PostImageCarousel } from "@/components/explore/post-image-carousel";
import { ShareSheet } from "@/components/share/share-sheet";
import { AppText } from "@/components/text";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { AppView } from "@/components/view";
import { Colors, Fonts } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { usePostLike } from "@/hooks/use-post-like";
import { resolveAvatarUri } from "@/lib/profile/resolve-avatar-uri";
import { supabase } from "@/lib/supabase";

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

  async function load() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    const uid = user?.id ?? null;

    const { data: row, error } = await supabase
      .from("activity_photos")
      .select("id, user_id, caption, created_at")
      .eq("id", id)
      .single();

    if (error || !row) {
      setLoading(false);
      return;
    }

    const [{ data: profile }, { data: images }, { data: likes }, { data: myLike }] =
      await Promise.all([
        supabase
          .from("profiles")
          .select("full_name, profile_picture")
          .eq("id", row.user_id)
          .single(),
        supabase
          .from("activity_photo_images")
          .select("image_path, position")
          .eq("post_id", row.id)
          .order("position", { ascending: true }),
        supabase.from("post_likes").select("post_id").eq("post_id", row.id),
        uid
          ? supabase
              .from("post_likes")
              .select("post_id")
              .eq("post_id", row.id)
              .eq("user_id", uid)
              .maybeSingle()
          : Promise.resolve({ data: null as { post_id: string } | null }),
      ]);

    setPost({
      id: row.id,
      userId: row.user_id,
      userName: profile?.full_name ?? "Rollin' User",
      avatarUrl: resolveAvatarUri(profile?.profile_picture),
      caption: row.caption,
      createdAt: row.created_at,
      imageUrls: (images ?? []).map(
        (image: any) =>
          supabase.storage.from("activity-photos").getPublicUrl(image.image_path)
            .data.publicUrl,
      ),
      likeCount: likes?.length ?? 0,
      likedByMe: !!myLike,
    });

    setLoading(false);
  }

  useEffect(() => {
    if (id) void load();
  }, [id]);

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
        <AppText style={{ color: colors.outline }}>Post not found.</AppText>
      </AppView>
    );
  }

  return <PostDetailView post={post} />;
}

function PostDetailView({ post }: { post: PostDetail }) {
  const theme = useColorScheme() ?? "light";
  const colors = Colors[theme];
  const insets = useSafeAreaInsets();

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
