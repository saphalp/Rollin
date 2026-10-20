import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { Button } from 'react-native-paper';

import { ProfilePrivacyGate } from '@/components/profile/ProfilePrivacyGate';
import { ReviewCard } from '@/components/reviews/ReviewCard';
import { ReviewFilter, type ReviewFilterValue } from '@/components/reviews/ReviewFilter';
import { ReviewFormSheet } from '@/components/reviews/ReviewFormSheet';
import { StarRating } from '@/components/reviews/StarRating';
import { AppText } from '@/components/text';
import { Colors, Fonts } from '@/constants/theme';
import { useAuthContext } from '@/hooks/use-auth-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { profileReviews, type ProfileReview, type ReviewKind } from '@/services/reviews-service';

const EMPTY_MESSAGE: Record<ReviewFilterValue, string> = {
  all: 'No reviews yet.',
  ride: 'No ride reviews yet.',
  host: 'No hosting reviews yet.',
};

export default function ReviewsScreen() {
  const { userId = '', kind, itemId } = useLocalSearchParams<{ userId: string; kind?: ReviewKind; itemId?: string }>();
  return (
    <>
      <Stack.Screen options={{ title: 'Reviews', headerBackTitle: 'Back', headerShown: true }} />
      <ProfilePrivacyGate userId={userId}>
        <ReviewsContent userId={userId} initialItem={kind && itemId ? { kind, item_id: itemId } : undefined} />
      </ProfilePrivacyGate>
    </>
  );
}

function ReviewsContent({ userId, initialItem }: { userId: string; initialItem?: { kind: ReviewKind; item_id: string } }) {
  const colors = Colors[useColorScheme() ?? 'light'];
  const { claims } = useAuthContext();
  const isOwnProfile = claims?.sub === userId;

  const [reviews, setReviews] = useState<ProfileReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<ReviewFilterValue>('all');
  const [formVisible, setFormVisible] = useState(Boolean(initialItem));

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setReviews(await profileReviews(userId));
    } catch (e) {
      console.error('[reviews] load failed:', e);
      setError('Unable to load reviews. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const shown = useMemo(() => (filter === 'all' ? reviews : reviews.filter((r) => r.kind === filter)), [filter, reviews]);
  // The header reflects the filter so "Hosting" shows the host average on its own.
  const average = shown.length ? shown.reduce((sum, r) => sum + r.stars, 0) / shown.length : null;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.summary, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}>
          <AppText style={[styles.average, { color: colors.text, fontFamily: Fonts.sans }]}>
            {average == null ? '—' : average.toFixed(1)}
          </AppText>
          <StarRating value={average ?? 0} size={20} />
          <AppText style={[styles.count, { color: colors.icon, fontFamily: Fonts.sans }]}>
            {loading ? 'Loading…' : `${shown.length} review${shown.length === 1 ? '' : 's'}`}
          </AppText>
          {!isOwnProfile && (
            <Button
              mode="contained"
              icon="star-outline"
              onPress={() => setFormVisible(true)}
              buttonColor={colors.tint}
              textColor={colors.onPrimary}
              style={styles.writeButton}
              contentStyle={styles.writeButtonContent}
              labelStyle={[styles.writeButtonLabel, { fontFamily: Fonts.sans }]}
            >
              Write a review
            </Button>
          )}
        </View>

        <ReviewFilter value={filter} onChange={setFilter} />

        {loading ? (
          <ActivityIndicator color={colors.tint} style={styles.loader} />
        ) : error ? (
          <AppText style={[styles.message, { color: colors.error, fontFamily: Fonts.sans }]}>{error}</AppText>
        ) : shown.length === 0 ? (
          <AppText style={[styles.message, { color: colors.outline, fontFamily: Fonts.sans }]}>{EMPTY_MESSAGE[filter]}</AppText>
        ) : (
          shown.map((review) => <ReviewCard key={`${review.kind}:${review.item_id}:${review.author_id}`} review={review} />)
        )}
      </ScrollView>

      {!isOwnProfile && (
        <ReviewFormSheet
          subjectId={userId}
          visible={formVisible}
          onClose={() => setFormVisible(false)}
          onSaved={() => void load()}
          initialItem={initialItem}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 32, gap: 16 },
  summary: { alignItems: 'center', gap: 6, padding: 20, borderRadius: 18, borderWidth: 1 },
  average: { fontSize: 40, lineHeight: 48, fontWeight: '800', letterSpacing: -0.5 },
  count: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  writeButton: { alignSelf: 'stretch', marginTop: 10 },
  writeButtonContent: { paddingVertical: 4 },
  writeButtonLabel: { fontSize: 15, fontWeight: '700' },
  loader: { paddingVertical: 32 },
  message: { fontSize: 15, lineHeight: 22, textAlign: 'center', paddingVertical: 32 },
});
