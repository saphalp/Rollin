import { supabase } from '@/lib/supabase';

export type ReviewKind = 'ride' | 'host';
export type ProfileReview = {
  kind: ReviewKind; item_id: string; item_title: string; item_date: string | null; author_id: string;
  author_name: string; author_picture: string | null; stars: number; comment: string; updated_at: string;
};
export type ReviewTarget = {
  kind: ReviewKind; item_id: string; title: string; item_date: string | null; my_stars: number | null; my_comment: string | null;
};
export type ReviewSummary = { average: number | null; count: number };

export async function profileReviews(userId: string): Promise<ProfileReview[]> {
  const { data, error } = await supabase.rpc('profile_reviews', { p_user_id: userId });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function reviewSummary(userId: string): Promise<ReviewSummary> {
  const { data, error } = await supabase.rpc('review_summary', { p_user_id: userId });
  if (error) throw new Error(error.message);
  const row = data?.[0];
  return { average: row?.average == null ? null : Number(row.average), count: Number(row?.count ?? 0) };
}

export async function reviewTargets(subjectId: string): Promise<ReviewTarget[]> {
  const { data, error } = await supabase.rpc('review_targets', { p_subject_id: subjectId });
  if (error) throw new Error(error.message);
  return data ?? [];
}

// Ride reviews reuse the existing ride rating RPC so both screens write the same rows.
export async function saveReview(subjectId: string, target: Pick<ReviewTarget, 'kind' | 'item_id'>, stars: number, comment: string) {
  const { error } = target.kind === 'ride'
    ? await supabase.rpc('save_ride_rating', { p_ride_id: target.item_id, p_recipient_id: subjectId, p_stars: stars, p_comment: comment })
    : await supabase.rpc('save_host_review', { p_activity_id: target.item_id, p_stars: stars, p_comment: comment });
  if (error) throw new Error(error.message);
}
