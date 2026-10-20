import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { reviewSummary, type ReviewSummary } from '@/services/reviews-service';

// Combined ride + host review average, refreshed whenever the screen regains focus.
export function useReviewSummary(userId: string) {
  const [summary, setSummary] = useState<ReviewSummary>({ average: null, count: 0 });

  useFocusEffect(useCallback(() => {
    let active = true;
    if (!userId) return;
    reviewSummary(userId)
      .then((next) => { if (active) setSummary(next); })
      .catch((e) => console.error('[profile] review summary failed:', e));
    return () => { active = false; };
  }, [userId]));

  return summary;
}
