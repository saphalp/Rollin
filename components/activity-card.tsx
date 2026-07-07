import { StyleSheet, TouchableOpacity, View } from 'react-native';

import { AppText } from '@/components/text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

const CATEGORY_ICONS = {
  grocery: 'cart',
  music: 'music.note',
  study: 'book.fill',
  outdoor: 'mountain.2',
  social: 'person.2.fill',
  sports: 'sportscourt.fill',
  gaming: 'gamecontroller.fill',
} as const;

type Category = keyof typeof CATEGORY_ICONS;

type ActivityCardProps = {
  title: string;
  category: Category;
  date?: string;
  host?: string;
  attendeeCount: number;
  maxAttendees: number;
  distance?: string;
  ridesAvailable?: number;
  onPress?: () => void;
};

export function ActivityCard({
  title,
  category,
  date,
  host,
  attendeeCount,
  maxAttendees,
  distance,
  ridesAvailable,
  onPress,
}: ActivityCardProps) {
  const theme = useColorScheme() ?? 'light';
  const colors = Colors[theme];

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={[styles.card, { backgroundColor: theme === 'light' ? '#ffffff' : colors.surfaceContainer, borderColor: colors.outlineVariant }]}
    >
      <View style={styles.topRow}>
        <IconSymbol name={CATEGORY_ICONS[category]} size={32} color={colors.text} />
        {ridesAvailable !== undefined && ridesAvailable > 0 && (
          <View style={[styles.badge, { backgroundColor: colors.secondaryContainer }]}>
            <AppText style={[styles.badgeText, { color: colors.onSecondaryContainer }]}>
              {ridesAvailable} seat{ridesAvailable !== 1 ? 's' : ''} left
            </AppText>
          </View>
        )}
      </View>

      <AppText style={[styles.title, { color: colors.text }]} numberOfLines={2}>
        {title}
      </AppText>

      {(date || host) && (
        <AppText style={[styles.meta, { color: colors.outline }]}>
          {host ? `Hosted by ${host}` : ''}{host && date ? '  ·  ' : ''}{date ?? ''}
        </AppText>
      )}

      <View style={styles.infoRow}>
        {distance && (
          <View style={styles.infoItem}>
            <IconSymbol name="mappin" size={14} color={colors.outline} />
            <AppText style={[styles.infoText, { color: colors.outline }]}>{distance}</AppText>
          </View>
        )}
      </View>

      <View style={styles.infoItem}>
        <IconSymbol name="person.2.fill" size={16} color={colors.outline} />
        <AppText style={[styles.infoText, { color: colors.outline }]}>
          {attendeeCount}/{maxAttendees} joined
        </AppText>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    gap: 8,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  badge: {
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: Fonts?.sans,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
    fontFamily: Fonts?.sans,
  },
  meta: {
    fontSize: 13,
    fontFamily: Fonts?.sans,
  },
  infoRow: {
    flexDirection: 'row',
    gap: 12,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  infoText: {
    fontSize: 13,
    fontFamily: Fonts?.sans,
  },
});
