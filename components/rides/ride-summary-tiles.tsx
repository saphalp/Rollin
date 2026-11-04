import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

import { AppText } from '@/components/text';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

type RideSummaryTilesProps = {
  offeringCount: number;
  requestCount: number;
  loading: boolean;
  onOfferingPress: () => void;
  onRequestsPress: () => void;
};

/** "Your rides" counts on the Discover tab; each tile jumps to its tab. */
export function RideSummaryTiles({
  offeringCount,
  requestCount,
  loading,
  onOfferingPress,
  onRequestsPress,
}: RideSummaryTilesProps) {
  const theme = useColorScheme() ?? 'light';
  const colors = Colors[theme];

  function renderTile(icon: IconName, count: number, label: string, onPress: () => void) {
    return (
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={loading ? label : `${count} ${label}`}
        onPress={onPress}
        style={[styles.tile, { backgroundColor: colors.cardBackground, borderColor: colors.outlineVariant }]}
      >
        <View style={styles.tileTop}>
          <MaterialCommunityIcons name={icon} size={20} color={colors.tint} />
          <MaterialCommunityIcons name="chevron-right" size={18} color={colors.tabIconDefault} />
        </View>
        <AppText style={[styles.count, { color: colors.text, fontFamily: Fonts?.sans }]}>
          {loading ? '–' : count}
        </AppText>
        <AppText style={[styles.label, { color: colors.icon, fontFamily: Fonts?.sans }]}>
          {label}
        </AppText>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.section}>
      <AppText style={[styles.heading, { color: colors.text, fontFamily: Fonts?.sans }]}>
        Your rides
      </AppText>
      <View style={styles.row}>
        {renderTile('car-outline', offeringCount, offeringCount === 1 ? 'Active offer' : 'Active offers', onOfferingPress)}
        {renderTile('account-arrow-right-outline', requestCount, requestCount === 1 ? 'Open request' : 'Open requests', onRequestsPress)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 10,
  },
  heading: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  tile: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
  },
  tileTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  count: {
    marginTop: 10,
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '700',
  },
  label: {
    fontSize: 13,
    lineHeight: 18,
  },
});
