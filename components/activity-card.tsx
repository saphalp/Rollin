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
  attendeeCount?: number;
  maxAttendees?: number;
  rideSharing?: boolean;
  isCampusEvent?: boolean;
  saved?: boolean;
  onBookmarkPress?: () => void;
  onPress?: () => void;
};

export function ActivityCard({
  title,
  category,
  date,
  imageUrl,
  attendeeCount,
  maxAttendees,
  rideSharing,
  isCampusEvent = false,
  saved = false,
  onBookmarkPress,
  onPress,
}: ActivityCardProps) {
  const theme = useColorScheme() ?? 'light';
  const colors = Colors[theme];

  const categoryLabel = category.trim() || (
    isCampusEvent ? 'Campus' : 'Activity'
  );

  const showAttendees =
    !isCampusEvent &&
    attendeeCount !== undefined &&
    maxAttendees !== undefined;

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

      {/* Overlay keeps text readable over the image. */}
      <View style={styles.dim} />

      <View style={styles.topRow}>
        {/* Keep the event category on the left. */}
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
            numberOfLines={1}
          >
            {categoryLabel.charAt(0).toUpperCase() +
              categoryLabel.slice(1)}
          </AppText>
        </View>

        <View style={styles.topRight}>
          {/* RSS events are identified separately from user posts. */}
          {isCampusEvent ? (
            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor: colors.secondaryContainer,
                },
              ]}
            >
              <AppText
                style={[
                  styles.statusBadgeText,
                  {
                    color: colors.onSecondaryContainer,
                    fontFamily: Fonts?.sans,
                  },
                ]}
              >
                Campus Event
              </AppText>
            </View>
          ) : rideSharing ? (
            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor: colors.secondaryContainer,
                },
              ]}
            >
              <IconSymbol
                name="car.fill"
                size={11}
                color={colors.onSecondaryContainer}
              />

              <AppText
                style={[
                  styles.statusBadgeText,
                  {
                    color: colors.onSecondaryContainer,
                    fontFamily: Fonts?.sans,
                  },
                ]}
              >
                Ride sharing
              </AppText>
            </View>
          ) : null}

          {/* Show bookmarking only when a handler is provided. */}
          {onBookmarkPress ? (
            <TouchableOpacity
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={
                saved ? 'Unsave event' : 'Save event'
              }
              onPress={(event) => {
                event.stopPropagation();
                onBookmarkPress();
              }}
            >
              <IconSymbol
                name={saved ? 'bookmark.fill' : 'bookmark'}
                size={22}
                color="#ffffff"
              />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

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

        {/* Campus events do not link to a user profile. */}
        {isCampusEvent ? (
          <AppText
            style={[
              styles.organizerText,
              {
                color: colors.onImageOverlay,
                fontFamily: Fonts?.sans,
              },
            ]}
            numberOfLines={1}
          >
            LA Tech · Campus Event
          </AppText>
        ) : null}

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

          {showAttendees ? (
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
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    height: 170,
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
    gap: 8,
  },
  topRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  categoryBadge: {
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    flexShrink: 1,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '600',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  bottom: {
    gap: 6,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 21,
  },
  organizerText: {
    fontSize: 12,
    fontWeight: '600',
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