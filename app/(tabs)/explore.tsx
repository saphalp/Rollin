import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { PostCard, type PostViewModel } from '@/components/explore/post-card';
import { AppText } from '@/components/text';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { resolveAvatarUri } from '@/lib/profile/resolve-avatar-uri';
import { supabase } from '@/lib/supabase';

const PAGE_SIZE = 10;

export default function ExploreScreen() {
  const theme = useColorScheme() ?? 'light';
  const colors = Colors[theme];

  const [posts, setPosts] = useState<PostViewModel[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const pageRef = useRef(0);
  const loadingRef = useRef(false);

  async function fetchPage(pageIndex: number, userId: string | null) {
    const from = pageIndex * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data: photos, error } = await supabase
      .from('activity_photos')
      .select('id, activity_id, user_id, image_path, caption, created_at')
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      console.error('fetchPage error:', error);
      return [] as PostViewModel[];
    }

    if (!photos || photos.length === 0) {
      setHasMore(false);
      return [] as PostViewModel[];
    }

    if (photos.length < PAGE_SIZE) setHasMore(false);

    const userIds = [...new Set(photos.map((p: any) => p.user_id))];
    const activityIds = [...new Set(photos.map((p: any) => p.activity_id))];
    const postIds = photos.map((p: any) => p.id);

    const [{ data: profiles }, { data: activities }, { data: likes }, { data: myLikes }] =
      await Promise.all([
        supabase.from('profiles').select('id, full_name, email, profile_picture').in('id', userIds),
        supabase.from('activities').select('id, title').in('id', activityIds),
        supabase.from('post_likes').select('post_id').in('post_id', postIds),
        userId
          ? supabase.from('post_likes').select('post_id').eq('user_id', userId).in('post_id', postIds)
          : Promise.resolve({ data: [] as { post_id: string }[] }),
      ]);

    const profileMap: Record<string, { full_name?: string; email?: string; profile_picture?: string }> =
      Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p]));

    const activityTitleMap: Record<string, string> = Object.fromEntries(
      (activities ?? []).map((a: any) => [a.id, a.title]),
    );

    const likeCountMap: Record<string, number> = {};
    for (const like of likes ?? []) {
      likeCountMap[like.post_id] = (likeCountMap[like.post_id] ?? 0) + 1;
    }

    const myLikedSet = new Set((myLikes ?? []).map((l: any) => l.post_id));

    return photos.map((p: any) => {
      const profile = profileMap[p.user_id];
      const name = profile?.full_name
        ?? (profile?.email ? profile.email.split('@')[0] : null)
        ?? 'Rollin\' User';

      return {
        id: p.id,
        userId: p.user_id,
        userName: name,
        avatarUrl: resolveAvatarUri(profile?.profile_picture),
        createdAt: p.created_at,
        activityId: p.activity_id,
        activityTitle: activityTitleMap[p.activity_id] ?? 'An activity',
        caption: p.caption,
        imageUrl: supabase.storage.from('activity-photos').getPublicUrl(p.image_path).data.publicUrl,
        likeCount: likeCountMap[p.id] ?? 0,
        likedByMe: myLikedSet.has(p.id),
      } satisfies PostViewModel;
    });
  }

  async function loadInitial() {
    setLoading(true);
    setHasMore(true);
    pageRef.current = 0;

    const {
      data: { user },
    } = await supabase.auth.getUser();
    setCurrentUserId(user?.id ?? null);

    const page = await fetchPage(0, user?.id ?? null);
    setPosts(page);
    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => {
    void loadInitial();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void loadInitial();
  }, []);

  async function loadMore() {
    if (loadingRef.current || !hasMore || loading) return;
    loadingRef.current = true;
    setLoadingMore(true);

    const nextPage = pageRef.current + 1;
    const page = await fetchPage(nextPage, currentUserId);
    pageRef.current = nextPage;
    setPosts((prev) => [...prev, ...page]);

    setLoadingMore(false);
    loadingRef.current = false;
  }

  function handleDelete(postId: string) {
    Alert.alert('Delete post', 'Are you sure you want to delete this post?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('activity_photos').delete().eq('id', postId);
          if (error) {
            Alert.alert('Error', error.message);
            return;
          }
          setPosts((prev) => prev.filter((p) => p.id !== postId));
        },
      },
    ]);
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator />
        </View>
      ) : (
        <FlatList
          data={posts}
          renderItem={({ item }) => (
            <PostCard
              post={item}
              isOwnPost={item.userId === currentUserId}
              onDelete={handleDelete}
            />
          )}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.postList}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={loadingMore ? <ActivityIndicator style={styles.footerLoader} /> : null}
          ListEmptyComponent={
            <View style={styles.empty}>
              <AppText style={{ color: colors.outline, textAlign: 'center' }}>
                No photos yet — be the first to share one from an activity you attended!
              </AppText>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  postList: {
    padding: 12,
    paddingBottom: 24,
    flexGrow: 1,
  },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  footerLoader: { marginVertical: 16 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, paddingHorizontal: 32 },
});
