import { useState } from 'react';
import { Image } from 'expo-image';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

import { AvailabilityRing } from '@/components/activity/availability-ring';
import { AppText } from '@/components/text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useReviewSummary } from '@/hooks/use-review-summary';

type Props = {
  title: string;
  rideSharing: boolean;
  hostId: string;
  hostName: string;
  hostAvatarUrl: string | null;
  dateTime: string | null;
  location: string | null;
  recurrenceLabel?: string | null;
  joined: number;
  max: number;
  description: string | null;
  onHostPress: () => void;
  onLocationPress: () => void;
};

// "Friday 7 PM" style label for the When tile.
function formatWhen(iso: string | null) {
  if (!iso) return 'Date TBD';
  const date = new Date(iso);
  const day = date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${day}\n${time}`;
}

// Main details card on the activity page: title, host, when/where, spots, about.
export function ActivityInfoCard({
  title,
  rideSharing,
  hostId,
  hostName,
  hostAvatarUrl,
  dateTime,
  location,
  recurrenceLabel,
  joined,
  max,
  description,
  onHostPress,
  onLocationPress,
}: Props) {
  const colors = Colors[useColorScheme() ?? 'light'];
  // Host's star rating from their reviews
  const { average, count } = useReviewSummary(hostId);
    // About text starts collapsed to 3 lines
  const [expanded, setExpanded] = useState(false);
  const isLongDescription = (description?.length ?? 0) > 140;

  const initials = hostName
    .trim()
    .split(' ')
    .map((word) => word[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.outlineVariant }]}>
      {/* Ride sharing pill */}
      {rideSharing && (
        <View style={[styles.pill, { backgroundColor: colors.secondaryContainer }]}>
          <IconSymbol name="car.fill" size={13} color={colors.onSecondaryContainer} />
          <AppText style={[styles.pillText, { color: colors.onSecondaryContainer, fontFamily: Fonts?.sans }]}>
            Ride Sharing Available
          </AppText>
        </View>
      )}

      {/* Title */}
      <AppText style={[styles.title, { color: colors.tint, fontFamily: Fonts?.sans }]}>{title}</AppText>

      {/* Host row */}
      <View style={[styles.hostRow, { borderColor: colors.outlineVariant }]}>
        {hostAvatarUrl ? (
          <Image source={{ uri: hostAvatarUrl }} style={styles.avatar} contentFit="cover" />
        ) : (
          <View style={[styles.avatar, styles.initials, { backgroundColor: colors.tint }]}>
            <AppText style={[styles.initialsText, { color: colors.onPrimary }]}>{initials}</AppText>
          </View>
        )}

        <View style={styles.hostText}>
          <AppText style={[styles.hostName, { color: colors.text, fontFamily: Fonts?.sans }]}>{hostName}</AppText>
          {average !== null && (
            <View style={styles.ratingRow}>
              <IconSymbol name="star.fill" size={13} color={colors.secondaryContainer} />
              <AppText style={[styles.rating, { color: colors.icon, fontFamily: Fonts?.sans }]}>
                {average.toFixed(1)} ({count})
              </AppText>
            </View>
          )}
        </View>

        <TouchableOpacity onPress={onHostPress} hitSlop={8}>
          <AppText style={[styles.link, { color: colors.tint, fontFamily: Fonts?.sans }]}>View Profile</AppText>
        </TouchableOpacity>
      </View>

      {/* When / Where tiles */}
      <View style={styles.tileRow}>
        <View style={[styles.tile, { backgroundColor: colors.surfaceContainer }]}>
          <IconSymbol name="calendar" size={18} color={colors.tint} />
          <AppText style={[styles.tileLabel, { color: colors.icon, fontFamily: Fonts?.sans }]}>WHEN</AppText>
          <AppText style={[styles.tileValue, { color: colors.text, fontFamily: Fonts?.sans }]}>
            {formatWhen(dateTime)}
          </AppText>
          {recurrenceLabel ? (
            <AppText style={[styles.tileNote, { color: colors.icon, fontFamily: Fonts?.sans }]}>
              {recurrenceLabel}
            </AppText>
          ) : null}
        </View>

        {/* Tapping Where opens the location in maps */}
        <TouchableOpacity
          style={[styles.tile, { backgroundColor: colors.surfaceContainer }]}
          disabled={!location}
          onPress={onLocationPress}
          accessibilityRole="link"
          accessibilityLabel={location ? `Open ${location} in maps` : undefined}
        >
          <IconSymbol name="mappin" size={18} color={colors.tint} />
          <AppText style={[styles.tileLabel, { color: colors.icon, fontFamily: Fonts?.sans }]}>WHERE</AppText>
          <AppText numberOfLines={3} style={[styles.tileValue, { color: colors.text, fontFamily: Fonts?.sans }]}>
            {location ?? 'Location TBD'}
          </AppText>
        </TouchableOpacity>
      </View>

      {/* Availability with % ring */}
      <View style={[styles.availability, { backgroundColor: colors.surfaceContainer }]}>
        <View style={styles.availabilityText}>
          <AppText style={[styles.tileLabel, { color: colors.icon, fontFamily: Fonts?.sans }]}>AVAILABILITY</AppText>
          <AppText style={[styles.tileValue, { color: colors.text, fontFamily: Fonts?.sans }]}>
            {joined} of {max} spots filled
          </AppText>
        </View>
        <AvailabilityRing joined={joined} max={max} />
      </View>

      {/* About */}
      {description ? (
        <View style={styles.about}>
          <AppText style={[styles.sectionHeading, { color: colors.text, fontFamily: Fonts?.sans }]}>
            About the Event
          </AppText>
                   <AppText
            numberOfLines={expanded ? undefined : 3}
            style={[styles.description, { color: colors.icon, fontFamily: Fonts?.sans }]}
          >
            {description}
          </AppText>
          
          {/* Only show the toggle when there's more to read */}
          {isLongDescription && (
            <TouchableOpacity onPress={() => setExpanded((value) => !value)} hitSlop={8}>
              <AppText style={[styles.link, { color: colors.tint, fontFamily: Fonts?.sans }]}>
                {expanded ? 'Show less' : 'Show more...'}
              </AppText>
            </TouchableOpacity>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
    gap: 16,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  pillText: { fontSize: 12, lineHeight: 16, fontWeight: '700' },
  title: { fontSize: 24, lineHeight: 30, fontWeight: '800' },
  hostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  initials: { alignItems: 'center', justifyContent: 'center' },
  initialsText: { fontSize: 15, lineHeight: 20, fontWeight: '700' },
  hostText: { flex: 1, gap: 2 },
  hostName: { fontSize: 16, lineHeight: 21, fontWeight: '700' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rating: { fontSize: 13, lineHeight: 17 },
  link: { fontSize: 14, lineHeight: 18, fontWeight: '600' },
  tileRow: { flexDirection: 'row', gap: 10 },
  tile: { flex: 1, borderRadius: 14, padding: 14, gap: 4 },
  tileLabel: { fontSize: 11, lineHeight: 14, fontWeight: '700', letterSpacing: 0.6 },
  tileValue: { fontSize: 16, lineHeight: 21, fontWeight: '700' },
  tileNote: { fontSize: 12, lineHeight: 16 },
  availability: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    padding: 14,
    gap: 12,
  },
  availabilityText: { flex: 1, gap: 4 },
  about: { gap: 8 },
  sectionHeading: { fontSize: 18, lineHeight: 24, fontWeight: '700' },
  description: { fontSize: 15, lineHeight: 23 },
});
