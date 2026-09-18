import { Image } from 'expo-image';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

import { AppText } from '@/components/text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type ActivityCardProps = {
  title: string;
  category: string;
  date?: string;
  host?: string;
  imageUrl?: string;
  attendeeCount: number;
  maxAttendees: number;
  rideSharing?: boolean;
  saved?: boolean;
  onBookmarkPress?: () => void;
  onPress?: () => void;

  // Boost feature
  showBoost?: boolean;
  boosted?: boolean;
  onBoost?: () => void;
};

export function ActivityCard({
  title,
  category,
  date,
  imageUrl,
  attendeeCount,
  maxAttendees,
  rideSharing,
  saved = false,
  onBookmarkPress,
  onPress,

  showBoost = false,
  boosted = false,
  onBoost,
}: ActivityCardProps) {
  const theme = useColorScheme() ?? 'light';
  const colors = Colors[theme];

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={[
        styles.card,
        { backgroundColor: colors.primaryContainer },
      ]}
    >
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
      ) : null}

      {/* Dark overlay */}
      <View style={styles.dim} />

<<<<<<< Updated upstream
      {/* top row: category badge + ride badge + bookmark */}
=======
      {/* Top row */}
>>>>>>> Stashed changes
      <View style={styles.topRow}>
        {/* Category */}
        <View
          style={[
            styles.categoryBadge,
            { backgroundColor: colors.tint },
          ]}
        >
          <AppText
            style={[
              styles.categoryText,
              {
                color: colors.onImageOverlay,
                fontFamily: Fonts?.sans,
              },
            ]}
          >
            {category.charAt(0).toUpperCase() + category.slice(1)}
          </AppText>
        </View>
<<<<<<< Updated upstream
        <View style={styles.topRight}>
          {rideSharing && (
            <View style={[styles.rideBadge, { backgroundColor: colors.secondaryContainer }]}>
              <IconSymbol name="car.fill" size={11} color={colors.onSecondaryContainer} />
              <AppText style={[styles.rideBadgeText, { color: colors.onSecondaryContainer, fontFamily: Fonts?.sans }]}>
=======

        {/* Right side badges/buttons */}
        <View style={styles.rightSection}>
          {rideSharing && (
            <View
              style={[
                styles.rideBadge,
                { backgroundColor: colors.secondaryContainer },
              ]}
            >
              <IconSymbol
                name="car.fill"
                size={11}
                color={colors.onSecondaryContainer}
              />

              <AppText
                style={[
                  styles.rideBadgeText,
                  {
                    color: colors.onSecondaryContainer,
                    fontFamily: Fonts?.sans,
                  },
                ]}
              >
>>>>>>> Stashed changes
                Ride sharing
              </AppText>
            </View>
          )}
<<<<<<< Updated upstream
          <TouchableOpacity hitSlop={8} onPress={(e) => { e.stopPropagation?.(); onBookmarkPress?.(); }}>
            <IconSymbol name={saved ? 'bookmark.fill' : 'bookmark'} size={20} color={colors.onImageOverlay} />
          </TouchableOpacity>
=======

          {/* BOOST BUTTON */}
          {showBoost && (
            <TouchableOpacity
              activeOpacity={0.8}
              disabled={boosted}
              onPress={(event) => {
                event.stopPropagation();
                onBoost?.();
              }}
              style={[
                styles.boostButton,
                boosted && styles.boostedButton,
              ]}
            >
              <AppText style={styles.boostButtonText}>
                {boosted ? '✓ Boosted' : 'Boost'}
              </AppText>
            </TouchableOpacity>
          )}
>>>>>>> Stashed changes
        </View>
      </View>

      {/* Bottom */}
      <View style={styles.bottom}>
        <AppText
          style={[
            styles.title,
            {
              color: colors.onImageOverlay,
              fontFamily: Fonts?.sans,
            },
          ]}
          numberOfLines={2}
        >
          {title}
        </AppText>

        <View style={styles.metaRow}>
          {date ? (
            <View style={styles.metaItem}>
              <IconSymbol
                name="calendar"
                size={12}
                color={colors.onImageOverlay}
              />

              <AppText
                style={[
                  styles.metaText,
                  {
                    color: colors.onImageOverlay,
                    fontFamily: Fonts?.sans,
                  },
                ]}
              >
                {date}
              </AppText>
            </View>
          ) : null}

          <View style={styles.metaItem}>
            <IconSymbol
              name="person.2.fill"
              size={12}
              color={colors.onImageOverlay}
            />

            <AppText
              style={[
                styles.metaText,
                {
                  color: colors.onImageOverlay,
                  fontFamily: Fonts?.sans,
                },
              ]}
            >
              {attendeeCount}/{maxAttendees}
            </AppText>
          </View>
        </View>
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
<<<<<<< Updated upstream
  topRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
=======

  rightSection: {
    alignItems: 'flex-end',
    gap: 6,
  },

>>>>>>> Stashed changes
  categoryBadge: {
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },

  categoryText: {
    fontSize: 11,
    fontWeight: '600',
  },

  rideBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },

  rideBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },

  boostButton: {
    backgroundColor: '#0058BE',
    borderRadius: 20,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },

  boostedButton: {
    backgroundColor: '#555555',
  },

  boostButtonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },

  bottom: {
    gap: 6,
  },

  title: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 21,
  },

  metaRow: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },

  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },

  metaText: {
    fontSize: 12,
  },
});