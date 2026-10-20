import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { StarRating } from '@/components/reviews/StarRating';
import { AppText } from '@/components/text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { resolveAvatarUri } from '@/lib/profile/resolve-avatar-uri';
import type { ProfileReview, ReviewKind } from '@/services/reviews-service';

export const KIND_LABEL: Record<ReviewKind, string> = { ride: 'Ride', host: 'Host' };

export function formatReviewDate(iso: string | null) {
  if (!iso) return 'Date TBD';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function ReviewCard({ review }: { review: ProfileReview }) {
  const colors = Colors[useColorScheme() ?? 'light'];

  return (
    <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.outlineVariant, shadowColor: colors.text }]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.push(`/profile/${review.author_id}`)}
          accessibilityRole="link"
          accessibilityLabel={`Open ${review.author_name}'s profile`}
          style={({ pressed }) => [styles.author, pressed && styles.pressed]}
        >
          <Image source={{ uri: resolveAvatarUri(review.author_picture) }} style={styles.avatar} contentFit="cover" />
          <View style={styles.authorText}>
            <AppText numberOfLines={1} style={[styles.name, { color: colors.text, fontFamily: Fonts.sans }]}>
              {review.author_name}
            </AppText>
            <StarRating value={review.stars} size={14} />
          </View>
        </Pressable>

        <View style={[styles.pill, { backgroundColor: colors.surfaceContainerHigh }]}>
          <IconSymbol name={review.kind === 'ride' ? 'car.fill' : 'person.2.fill'} size={12} color={colors.tint} />
          <AppText style={[styles.pillText, { color: colors.text, fontFamily: Fonts.sans }]}>{KIND_LABEL[review.kind]}</AppText>
        </View>
      </View>

      <AppText numberOfLines={1} style={[styles.item, { color: colors.icon, fontFamily: Fonts.sans }]}>
        {review.item_title} · {formatReviewDate(review.item_date)}
      </AppText>

      {review.comment ? (
        <AppText style={[styles.comment, { color: colors.text, fontFamily: Fonts.sans }]}>{review.comment}</AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 10,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  author: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  pressed: { opacity: 0.7 },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  authorText: { flex: 1, gap: 2 },
  name: { fontSize: 15, lineHeight: 20, fontWeight: '700' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { fontSize: 11, lineHeight: 14, fontWeight: '700' },
  item: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  comment: { fontSize: 14, lineHeight: 21 },
});
