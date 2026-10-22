import { supabase } from '@/lib/supabase';

export type FeaturedScore = { score: number; isFull: boolean };

type Rankable = { id: string; sortKey: string; attendeeCount: number; maxAttendees: number };

/**
 * Engagement scores for the Home "Featured" carousel, computed server-side by
 * `featured_activity_scores` (see supabase/migrations/20261021130000_featured_activity_scores.sql
 * for the weights). Returns an empty map on failure so Home falls back to date order.
 */
export async function fetchFeaturedScores(activityIds: string[]): Promise<Map<string, FeaturedScore>> {
  if (activityIds.length === 0) return new Map();
  const { data, error } = await supabase.rpc('featured_activity_scores', { p_activity_ids: activityIds });
  if (error) {
    console.error('[featured] score fetch failed:', error);
    return new Map();
  }
  return new Map(
    (data ?? []).map((row: { activity_id: string; score: number | string; is_full: boolean }) => [
      row.activity_id,
      { score: Number(row.score) || 0, isFull: row.is_full },
    ]),
  );
}

/**
 * Top `limit` activities by score. Full activities rank after every activity that still has
 * room, so they're only featured when there aren't enough open ones. Ties go to the sooner
 * activity.
 */
export function rankFeatured<T extends Rankable>(
  activities: T[],
  scores: Map<string, FeaturedScore>,
  limit = 3,
): T[] {
  const isFull = (a: T) => scores.get(a.id)?.isFull ?? a.attendeeCount >= a.maxAttendees;
  const score = (a: T) => scores.get(a.id)?.score ?? 0;
  return [...activities]
    .sort((a, b) =>
      Number(isFull(a)) - Number(isFull(b))
      || score(b) - score(a)
      || a.sortKey.localeCompare(b.sortKey)
      || a.id.localeCompare(b.id))
    .slice(0, limit);
}

/** Records a unique view of an activity (no-op for the host or repeat views). */
export async function recordActivityView(activityId: string): Promise<void> {
  const { error } = await supabase.rpc('record_activity_view', { p_activity_id: activityId });
  if (error) console.error('[featured] view record failed:', error);
}
