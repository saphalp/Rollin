import { supabase } from '@/lib/supabase';

export type RatingTarget = { ride_id: string; recipient_id: string; name: string; destination: string };
export type RideRating = { ride_id: string; author_id: string; recipient_id: string; stars: number; comment: string };

export async function ratingTargets(rideId?: string): Promise<RatingTarget[]> {
  const { data, error } = await supabase.rpc('ride_rating_targets', { p_ride_id: rideId ?? null });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function myRatings(rideId: string): Promise<RideRating[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Please sign in.');
  const { data, error } = await supabase.from('ride_ratings').select('*').eq('ride_id', rideId).eq('author_id', user.id);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function saveRating(target: RatingTarget, stars: number, comment: string) {
  const { error } = await supabase.rpc('save_ride_rating', {
    p_ride_id: target.ride_id, p_recipient_id: target.recipient_id, p_stars: stars, p_comment: comment,
  });
  if (error) throw new Error(error.message);
}
