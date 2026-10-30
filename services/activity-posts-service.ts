import { resolveAvatarUri } from '@/lib/profile/resolve-avatar-uri';
import { supabase } from '@/lib/supabase';

export type ActivityPost = {
  id: string; activityId: string; userId: string; userName: string; avatarUrl: string;
  caption: string | null; createdAt: string; imageUrls: string[]; likeCount: number; likedByMe: boolean;
};
export type PostCursor = { id: string; createdAt: string };
type PostRow = {
  id: string; activity_id: string; user_id: string; author_name: string | null; avatar_path: string | null;
  caption: string | null; created_at: string; image_paths: string[]; like_count: number; liked_by_me: boolean;
};
export const ACTIVITY_POST_PAGE_SIZE = 6;

async function fetchPosts(params: Record<string, unknown>, signal: AbortSignal): Promise<ActivityPost[]> {
  const { data, error } = await supabase.rpc('get_activity_explore_posts', params).abortSignal(signal);
  // Never fall back to an unfiltered query if the database setup is missing.
  if (error) throw new Error('Could not load posts. Please try again.');
  return (data ?? []).map((row: PostRow) => ({
    id: row.id, activityId: row.activity_id, userId: row.user_id,
    userName: row.author_name || "Rollin' User", avatarUrl: resolveAvatarUri(row.avatar_path),
    caption: row.caption, createdAt: row.created_at,
    imageUrls: (row.image_paths ?? []).map(path => supabase.storage.from('activity-photos').getPublicUrl(path).data.publicUrl),
    likeCount: Number(row.like_count), likedByMe: row.liked_by_me,
  }));
}

export async function loadActivityPosts(activityId: string, cursor: PostCursor | null, signal: AbortSignal) {
  const rows = await fetchPosts({
    p_activity_id: activityId, p_before_created_at: cursor?.createdAt ?? null,
    p_before_id: cursor?.id ?? null, p_limit: ACTIVITY_POST_PAGE_SIZE + 1,
  }, signal);
  const posts = rows.slice(0, ACTIVITY_POST_PAGE_SIZE);
  return { posts, hasMore: rows.length > ACTIVITY_POST_PAGE_SIZE, cursor: posts.at(-1) ?? null };
}

export async function loadExplorePost(postId: string, signal: AbortSignal) {
  return (await fetchPosts({ p_post_id: postId, p_limit: 1 }, signal))[0] ?? null;
}
