import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { View } from 'react-native';
import { AppText } from '@/components/text';
import { supabase } from '@/lib/supabase';

export function RideRatingSummary({ userId, isOwnProfile, onAverage }: {
  userId: string; isOwnProfile: boolean; onAverage: (value: number | null) => void;
}) {
  const [count, setCount] = useState<number | null>(null);
  const [comments, setComments] = useState<{ comment: string; stars: number; ride_id: string; author_id: string }[]>([]);
  const [error, setError] = useState('');
  useFocusEffect(useCallback(() => {
    let active = true;
    onAverage(null); setCount(null); setComments([]); setError('');
    void (async () => {
      const summary = await supabase.rpc('ride_rating_summary', { p_user_id: userId });
      if (!active) return;
      if (summary.error) { setError('Ratings are unavailable.'); return; }
      onAverage(summary.data?.[0]?.average == null ? null : Number(summary.data[0].average));
      setCount(Number(summary.data?.[0]?.count ?? 0));
      if (isOwnProfile) {
        const result = await supabase.from('ride_ratings').select('ride_id,author_id,stars,comment').eq('recipient_id', userId).neq('comment', '').order('updated_at', { ascending: false });
        if (active) {
          if (result.error) setError('Could not load your comments.');
          else setComments(result.data ?? []);
        }
      }
    })().catch(() => { if (active) setError('Ratings are unavailable.'); });
    return () => { active = false; };
  }, [userId, isOwnProfile, onAverage]));
  return <View style={{ gap: 8 }}>
    <AppText>{error || (count === null ? 'Loading ratings…' : count ? `${count} ride rating${count === 1 ? '' : 's'}` : 'No ratings yet')}</AppText>
    {comments.length > 0 && <AppText style={{ fontWeight: '700' }}>Feedback from your rides (only visible to you)</AppText>}
    {comments.map(c => <AppText key={`${c.ride_id}-${c.author_id}`}>{c.stars} ★ · {c.comment}</AppText>)}
  </View>;
}
