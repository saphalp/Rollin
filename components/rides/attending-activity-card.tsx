import { StyleSheet, TouchableOpacity, View } from 'react-native';

import { AppText } from '@/components/text';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

const CATEGORY_ICONS: Record<string, IconSymbolName> = {
  social: 'person.2.fill',
  sports: 'sportscourt.fill',
  music: 'music.note',
  study: 'book.fill',
  outdoor: 'mountain.2',
  gaming: 'gamecontroller.fill',
  grocery: 'cart',
};

export type AttendingActivityCardProps = {
  title: string;
  category: string;
  dateLabel?: string;
  location?: string;
  onPress?: () => void;
};

export function AttendingActivityCard({
  title,
  category,
  dateLabel,
  location,
  onPress,
}: AttendingActivityCardProps) {
  const theme = useColorScheme() ?? 'light';
  const colors = Colors[theme];
  const icon = CATEGORY_ICONS[category] ?? 'calendar';

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.outlineVariant }]}
    >
      <View style={[styles.iconBadge, { backgroundColor: colors.primaryContainer }]}>
        <IconSymbol name={icon} size={16} color={colors.onPrimary} />
      </View>

      <AppText
        numberOfLines={2}
        style={[styles.title, { color: colors.text, fontFamily: Fonts?.sans }]}
      >
        {title}
      </AppText>

      {dateLabel && (
        <View style={styles.metaRow}>
          <IconSymbol name="calendar" size={11} color={colors.icon} />
          <AppText numberOfLines={1} style={[styles.metaText, { color: colors.icon, fontFamily: Fonts?.sans }]}>
            {dateLabel}
          </AppText>
        </View>
      )}

      {location && (
        <View style={styles.metaRow}>
          <IconSymbol name="mappin" size={11} color={colors.icon} />
          <AppText numberOfLines={1} style={[styles.metaText, { color: colors.icon, fontFamily: Fonts?.sans }]}>
            {location}
          </AppText>
        </View>
      )}
    </TouchableOpacity>
  );
}

const CARD_WIDTH = 148;

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    gap: 6,
  },
  iconBadge: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 17,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    flex: 1,
    fontSize: 11,
  },
});
