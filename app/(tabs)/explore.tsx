import { TourTarget } from '@/components/tutorial/tour-target';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  FlatList,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';

import { PostCard, type PostViewModel } from '@/components/explore/post-card';
import { AppText } from '@/components/text';
import { Colors, Fonts } from '@/constants/theme';
import { useAuthContext } from '@/hooks/use-auth-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { subscribeAccountChanges } from '@/lib/account-center';
import { resolveAvatarUri } from '@/lib/profile/resolve-avatar-uri';
import { supabase } from '@/lib/supabase';

const PAGE_SIZE = 10;

/**
 * Deduplicates posts by ID in O(N + M) time.
 * Preserves the order of existing posts and discards any duplicates within
 * incoming or between existing and incoming items.
 */
export function deduplicatePosts(
  existing: PostViewModel[],
  incoming: PostViewModel[]
): PostViewModel[] {
  const seen = new Set<string>();
  const result: PostViewModel[] = [];

  for (const post of existing) {
    if (post && post.id && !seen.has(post.id)) {
      seen.add(post.id);
      result.push(post);
    }
  }

  for (const post of incoming) {
    if (post && post.id && !seen.has(post.id)) {
      seen.add(post.id);
      result.push(post);
    }
  }

  return result;
}

export default function ExploreScreen() {
  const theme = useColorScheme() ?? 'light';
  const colors = Colors[theme];
  const { claims, profile } = useAuthContext();
  const currentUserId = (claims?.sub as string | undefined) ?? profile?.id ?? null;

  const [posts, setPosts] = useState<PostViewModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState('');
  const pageRef = useRef(0);
  const loadingRef = useRef(false);

  const fetchPage = useCallback(
    async (pageIndex: number, userId: string | null, signal?: AbortSignal) => {
      const from = pageIndex * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from('activity_photos')
        .select('id, activity_id, user_id, image_path, caption, created_at')
        .order('created_at', { ascending: false })
        .range(from, to);

      if (signal) {
        query = query.abortSignal(signal);
      }

      const { data: photos, error: fetchError } = await query;

      if (fetchError) {
        console.error('fetchPage error:', fetchError);
        throw fetchError;
      }

      if (!photos || photos.length === 0) {
        setHasMore(false);
        return [] as PostViewModel[];
      }

      if (photos.length < PAGE_SIZE) setHasMore(false);

      const userIds = [...new Set(photos.map((p: any) => p.user_id))];
      const activityIds = [...new Set(photos.map((p: any) => p.activity_id))];
      const postIds = photos.map((p: any) => p.id);

      let profilesQuery = supabase
        .from('profiles')
        .select('id, full_name, profile_picture')
        .in('id', userIds);
      let activitiesQuery = supabase
        .from('activities')
        .select('id, title')
        .in('id', activityIds);
      let likesQuery = supabase
        .from('post_likes')
        .select('post_id')
        .in('post_id', postIds);
      let myLikesQuery = userId
        ? supabase.from('post_likes').select('post_id').eq('user_id', userId).in('post_id', postIds)
        : null;
      let imagesQuery = supabase
        .from('activity_photo_images')
        .select('post_id, image_path, position')
        .in('post_id', postIds)
        .order('position', { ascending: true });

      if (signal) {
        profilesQuery = profilesQuery.abortSignal(signal);
        activitiesQuery = activitiesQuery.abortSignal(signal);
        likesQuery = likesQuery.abortSignal(signal);
        if (myLikesQuery) myLikesQuery = myLikesQuery.abortSignal(signal);
        imagesQuery = imagesQuery.abortSignal(signal);
      }

      const [{ data: profilesData }, { data: activitiesData }, { data: likesData }, { data: myLikesData }, { data: imagesData }] =
        await Promise.all([
          profilesQuery,
          activitiesQuery,
          likesQuery,
          myLikesQuery ?? Promise.resolve({ data: [] as { post_id: string }[], error: null }),
          imagesQuery,
        ]);

      const profileMap: Record<string, { full_name?: string | null; profile_picture?: string | null }> =
        Object.fromEntries((profilesData ?? []).map((p: any) => [p.id, p]));

      const activityTitleMap: Record<string, string> = Object.fromEntries(
        (activitiesData ?? []).map((a: any) => [a.id, a.title]),
      );

      const likeCountMap: Record<string, number> = {};
      for (const like of likesData ?? []) {
        likeCountMap[like.post_id] = (likeCountMap[like.post_id] ?? 0) + 1;
      }

      const myLikedSet = new Set((myLikesData ?? []).map((l: any) => l.post_id));

      const imageUrlsByPost: Record<string, string[]> = {};
      for (const image of imagesData ?? []) {
        if (image.image_path) {
          const url = supabase.storage.from('activity-photos').getPublicUrl(image.image_path).data.publicUrl;
          (imageUrlsByPost[image.post_id] ??= []).push(url);
        }
      }

      return photos.map((p: any) => {
        const prof = profileMap[p.user_id];
        const name = prof?.full_name?.trim() || "Rollin' User";

        let imageUrls = imageUrlsByPost[p.id];
        if (!imageUrls || imageUrls.length === 0) {
          if (p.image_path) {
            imageUrls = [supabase.storage.from('activity-photos').getPublicUrl(p.image_path).data.publicUrl];
          } else {
            imageUrls = [];
          }
        }

        return {
          id: p.id,
          userId: p.user_id,
          userName: name,
          avatarUrl: resolveAvatarUri(prof?.profile_picture),
          createdAt: p.created_at,
          activityId: p.activity_id,
          activityTitle: activityTitleMap[p.activity_id] ?? 'An activity',
          caption: p.caption,
          imageUrls,
          likeCount: likeCountMap[p.id] ?? 0,
          likedByMe: myLikedSet.has(p.id),
        } satisfies PostViewModel;
      });
    },
    []
  );

  const loadInitial = useCallback(
    async (signal?: AbortSignal) => {
      if (loadingRef.current) return;
      loadingRef.current = true;
      setLoading(true);
      setError('');
      setHasMore(true);
      pageRef.current = 0;

      try {
        const page = await fetchPage(0, currentUserId, signal);
        if (signal?.aborted) return;
        setPosts(deduplicatePosts([], page));
      } catch (err: any) {
        if (signal?.aborted) return;
        console.error('loadInitial error:', err);
        setError('Could not load explore posts. Please try again.');
        setPosts([]);
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
          setRefreshing(false);
          loadingRef.current = false;
        }
      }
    },
    [currentUserId, fetchPage]
  );

  useFocusEffect(
    useCallback(() => {
      let active = true;
      let controller: AbortController | null = new AbortController();

      void loadInitial(controller.signal);

      const unsubscribe = subscribeAccountChanges(() => {
        if (active) {
          controller?.abort();
          controller = new AbortController();
          void loadInitial(controller.signal);
        }
      });

      const appSub = AppState.addEventListener('change', (state) => {
        if (state === 'active' && active) {
          controller?.abort();
          controller = new AbortController();
          void loadInitial(controller.signal);
        } else if (state !== 'active') {
          controller?.abort();
        }
      });

      return () => {
        active = false;
        controller?.abort();
        controller = null;
        unsubscribe();
        appSub.remove();
      };
    }, [loadInitial])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void loadInitial();
  }, [loadInitial]);

  async function loadMore() {
    if (loadingRef.current || !hasMore || loading || refreshing || error) return;
    loadingRef.current = true;
    setLoadingMore(true);

    try {
      const nextPage = pageRef.current + 1;
      const page = await fetchPage(nextPage, currentUserId);
      pageRef.current = nextPage;
      setPosts((prev) => deduplicatePosts(prev, page));
    } catch (err: any) {
      console.error('loadMore error:', err);
    } finally {
      setLoadingMore(false);
      loadingRef.current = false;
    }
  }

  function handleDelete(postId: string) {
    Alert.alert('Delete post', 'Are you sure you want to delete this post?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            // 1. Collect file paths before DB deletion (while references still exist)
            const [{ data: photoData }, { data: imagesData }] = await Promise.all([
              supabase.from('activity_photos').select('image_path').eq('id', postId).maybeSingle(),
              supabase.from('activity_photo_images').select('image_path').eq('post_id', postId),
            ]);

            const pathsToDelete: string[] = [];
            if (photoData?.image_path) pathsToDelete.push(photoData.image_path);
            for (const img of imagesData ?? []) {
              if (img.image_path && !pathsToDelete.includes(img.image_path)) {
                pathsToDelete.push(img.image_path);
              }
            }

            // 2. Delete database record with user ownership guard
            const { error: deleteError } = await supabase
              .from('activity_photos')
              .delete()
              .eq('id', postId)
              .eq('user_id', currentUserId);

            if (deleteError) {
              Alert.alert('Error', deleteError.message);
              return;
            }

            // 3. Remove files from storage
            if (pathsToDelete.length > 0) {
              const { error: storageError } = await supabase.storage
                .from('activity-photos')
                .remove(pathsToDelete);
              if (storageError) {
                console.warn('[explore] Storage removal warning:', storageError.message);
              }
            }

            // 4. Update UI
            setPosts((prev) => prev.filter((p) => p.id !== postId));
          } catch (err: any) {
            Alert.alert('Error', err?.message ?? 'Failed to delete post.');
          }
        },
      },
    ]);
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={colors.tint} />
        </View>
      ) : (
        <FlatList
          data={posts}
          renderItem={({ item, index }) => {
            const card = (
              <PostCard
                post={item}
                isOwnPost={item.userId === currentUserId}
                onDelete={handleDelete}
              />
            );
            // The tutorial's "Follow a shared experience" step highlights the first post.
            return index === 0 ? <TourTarget id="explore-first-post">{card}</TourTarget> : card;
          }}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.postList}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.tint}
              colors={[colors.tint]}
            />
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator color={colors.tint} style={styles.footerLoader} />
            ) : undefined
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              {error ? (
                <>
                  <AppText
                    accessibilityRole="alert"
                    style={[styles.emptyText, { color: colors.error, fontFamily: Fonts?.sans }]}
                  >
                    {error}
                  </AppText>
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Retry loading explore posts"
                    onPress={() => void loadInitial()}
                    style={[styles.retryButton, { backgroundColor: colors.tint }]}
                    activeOpacity={0.8}
                  >
                    <AppText
                      style={[styles.retryButtonText, { color: colors.onPrimary, fontFamily: Fonts?.sans }]}
                    >
                      Retry
                    </AppText>
                  </TouchableOpacity>
                </>
              ) : (
                <TourTarget id="explore-first-post">
                  <AppText
                    style={[styles.emptyText, { color: colors.outline, fontFamily: Fonts?.sans }]}
                  >
                    No photos yet — be the first to share one from an activity you attended!
                  </AppText>
                </TourTarget>
              )}
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
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    paddingHorizontal: 32,
    gap: 16,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
