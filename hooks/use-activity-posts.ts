import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { useAuthContext } from '@/hooks/use-auth-context';
import { subscribeAccountChanges } from '@/lib/account-center';
import { loadActivityPosts, type ActivityPost, type PostCursor } from '@/services/activity-posts-service';

export function useActivityPosts(activityId: string) {
  const userId = useAuthContext().claims?.sub as string | undefined;
  const [posts, setPosts] = useState<ActivityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const actions = useRef<{ refresh: () => void; more: () => void } | null>(null);

  useFocusEffect(useCallback(() => {
    let active = true;
    let controller: AbortController | null = null;
    let cursor: PostCursor | null = null;
    let canLoadMore = false;
    let busy = false;
    setPosts([]); setError(''); setHasMore(false); setLoading(!!userId);

    async function load(append: boolean) {
      if (!userId || !active || (append && (busy || !canLoadMore))) return;
      controller?.abort();
      const request = new AbortController(); controller = request;
      busy = true; setLoading(true); setError('');
      if (!append) { cursor = null; setPosts([]); setHasMore(false); }
      try {
        const result = await loadActivityPosts(activityId, append ? cursor : null, request.signal);
        if (!active || request.signal.aborted) return;
        cursor = result.cursor; canLoadMore = result.hasMore;
        setPosts(previous => append
          ? [...previous, ...result.posts.filter(post => !previous.some(existing => existing.id === post.id))]
          : result.posts);
        setHasMore(result.hasMore);
      } catch {
        if (active && !request.signal.aborted) {
          // A failed permissions refresh must not keep previously visible posts.
          setPosts([]); setHasMore(false); canLoadMore = false;
          setError('Could not load posts. Please try again.');
        }
      } finally {
        if (active && !request.signal.aborted) { busy = false; setLoading(false); }
      }
    }
    const refresh = () => { void load(false); };
    actions.current = { refresh, more: () => { void load(true); } };
    refresh();
    const unsubscribe = subscribeAccountChanges(refresh);
    const app = AppState.addEventListener('change', state => {
      if (state === 'active') refresh();
      else { controller?.abort(); setPosts([]); setHasMore(false); }
    });
    return () => {
      active = false; controller?.abort(); actions.current = null;
      unsubscribe(); app.remove(); setPosts([]);
    };
  }, [activityId, userId]));

  return { posts, loading, error, hasMore,
    refresh: () => actions.current?.refresh(), loadMore: () => actions.current?.more() };
}
