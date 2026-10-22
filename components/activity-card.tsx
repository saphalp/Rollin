import { Image } from 'expo-image';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

import { AppText } from '@/components/text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { openEventMap } from '@/lib/open-event-map';

type ActivityCardProps = {
  title: string;
  category: string;
  date?: string;
  location?: string;
  isCampusEvent?: boolean;
  host?: string;
  imageUrl?: string;
  attendeeCount?: number;
  maxAttendees?: number;
  rideSharing?: boolean;
  recurring?: boolean;
  waitlistPosition?: number | null;
  saved?: boolean;
  onBookmarkPress?: () => void;
  onPress?: () => void;
};

export function ActivityCard({
  title,
  category,
  date,
  location,
  isCampusEvent = false,
  imageUrl,
  attendeeCount,
  maxAttendees,
  rideSharing,
  recurring = false,
  waitlistPosition,
  saved = false,
  onBookmarkPress,
  onPress,
}: ActivityCardProps) {
  const theme = useColorScheme() ?? 'light';
  const colors = Colors[theme];

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={[styles.card, { backgroundColor: colors.primaryContainer }]}
    >
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
      ) : null}

      {/* dark overlay so text is always readable */}
      <View style={styles.dim} />

      {/* Category and Campus Event appear side by side on the left; ride sharing and bookmark stay on the right. */}
      <View style={styles.topRow}>
        <View style={styles.topLeft}>
          <View style={[styles.categoryBadge, { backgroundColor: colors.tint }]}>
            <AppText numberOfLines={1} style={[styles.categoryText, { color: colors.onImageOverlay, fontFamily: Fonts?.sans }]}>
              {category.charAt(0).toUpperCase() + category.slice(1)}
            </AppText>
          </View>
          {isCampusEvent && (
            <View style={[styles.rideBadge, { backgroundColor: colors.secondaryContainer }]}>
              <AppText style={[styles.rideBadgeText, { color: colors.onSecondaryContainer, fontFamily: Fonts?.sans }]}>Campus Event</AppText>
            </View>
          )}
        </View>
        <View style={styles.topRight}>
          {rideSharing && (
            <View style={[styles.rideBadge, { backgroundColor: colors.secondaryContainer }]}>
              <IconSymbol name="car.fill" size={11} color={colors.onSecondaryContainer} />
              <AppText style={[styles.rideBadgeText, { color: colors.onSecondaryContainer, fontFamily: Fonts?.sans }]}>
                Ride sharing
              </AppText>
            </View>
          )}
          {recurring && (
            <View style={[styles.rideBadge, { backgroundColor: 'rgba(99,102,241,0.85)' }]}>
              <IconSymbol name="arrow.triangle.2.circlepath" size={11} color="#fff" />
              <AppText style={[styles.rideBadgeText, { color: '#fff', fontFamily: Fonts?.sans }]}>
                Recurring
              </AppText>
            </View>
          )}
          <View onStartShouldSetResponder={() => true}>
            <TouchableOpacity hitSlop={8} onPress={() => onBookmarkPress?.()}>
              <IconSymbol
                name={saved ? 'bookmark.fill' : 'bookmark'}
                size={22}
                color="#ffffff"
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* bottom: title + meta */}
      <View style={styles.bottom}>
        <AppText style={[styles.title, { color: colors.onImageOverlay, fontFamily: Fonts?.sans }]} numberOfLines={2}>
          {title}
        </AppText>
        <View style={styles.metaRow}>
          {date ? (
            <View style={styles.metaItem}>
              <IconSymbol name="calendar" size={12} color={colors.onImageOverlay} />
              <AppText numberOfLines={1} style={[styles.metaText, { color: colors.onImageOverlay, fontFamily: Fonts?.sans }]}>
                {date}
              </AppText>
            </View>
          ) : null}
          {attendeeCount !== undefined && <View style={styles.metaItem}>
            <IconSymbol name="person.2.fill" size={12} color={colors.onImageOverlay} />
            <AppText numberOfLines={1} style={[styles.metaText, { color: colors.onImageOverlay, fontFamily: Fonts?.sans }]}>
              {isCampusEvent ? `${attendeeCount} joined` : `${attendeeCount}/${maxAttendees}`}
            </AppText>
          </View>}
          {waitlistPosition ? (
            <View style={styles.metaItem}>
              <IconSymbol name="clock" size={12} color={colors.onImageOverlay} />
              <AppText style={[styles.metaText, { color: colors.onImageOverlay, fontFamily: Fonts?.sans }]}>
                Waitlist #{waitlistPosition}
              </AppText>
            </View>
          ) : null}
        </View>
        {!!location && (
          <View onStartShouldSetResponder={() => true}>
            <TouchableOpacity
              accessibilityRole="link"
              accessibilityLabel={`Open ${location} in maps`}
              activeOpacity={0.7}
              onPress={() => void openEventMap(location)}
              style={styles.metaItem}
              hitSlop={8}
            >
              <IconSymbol name="mappin" size={12} color={colors.onImageOverlay} />
              <AppText numberOfLines={1} style={[styles.metaText, { flex: 1, color: colors.onImageOverlay, fontFamily: Fonts?.sans, textDecorationLine: 'underline' }]}>{location}</AppText>
              <IconSymbol name="arrow.up.right" size={12} color={colors.onImageOverlay} />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    height: 150,
    overflow: 'hidden',
    justifyContent: 'space-between',
    padding: 12,
  },
  dim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.38)',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  topLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  topRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  categoryBadge: {
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  categoryText: { fontSize: 11, fontWeight: '600' },
  rideBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  rideBadgeText: { fontSize: 11, fontWeight: '600' },
  bottom: { gap: 6 },
  title: { fontSize: 16, fontWeight: '700', lineHeight: 21 },
  metaRow: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12 },
});
