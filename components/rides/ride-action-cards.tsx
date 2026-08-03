import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

import { AppText } from '@/components/text';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type RideActionCardsProps = {
  onFindRide: () => void;
  onOfferRide: () => void;
};

export function RideActionCards({ onFindRide, onOfferRide }: RideActionCardsProps) {
  const theme = useColorScheme() ?? 'light';
  const colors = Colors[theme];

  return (
    <View style={styles.actionRow}>
      <TouchableOpacity
        accessibilityRole="button"
        onPress={onFindRide}
        style={[styles.actionCard, { backgroundColor: colors.tint, borderColor: colors.tint }]}
      >
        <View style={[styles.actionIcon, { backgroundColor: colors.onPrimary }]}>
          <MaterialCommunityIcons name="car-search-outline" size={25} color={colors.tint} />
        </View>

        <AppText style={[styles.actionTitle, { color: colors.onPrimary, fontFamily: Fonts?.sans }]}>
          Find a Ride
        </AppText>

        <AppText style={[styles.actionText, { color: colors.onPrimary, fontFamily: Fonts?.sans }]}>
          Search by route, date, time, or activity.
        </AppText>
      </TouchableOpacity>

      <TouchableOpacity
        accessibilityRole="button"
        onPress={onOfferRide}
        style={[styles.actionCard, { backgroundColor: colors.cardBackground, borderColor: colors.outlineVariant }]}
      >
        <View style={[styles.actionIcon, { backgroundColor: colors.primaryContainer }]}>
          <MaterialCommunityIcons name="car-multiple" size={25} color={colors.onPrimary} />
        </View>

        <AppText style={[styles.actionTitle, { color: colors.text, fontFamily: Fonts?.sans }]}>
          Offer a Ride
        </AppText>

        <AppText style={[styles.actionText, { color: colors.icon, fontFamily: Fonts?.sans }]}>
          Share seats for any trip or a public activity.
        </AppText>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionCard: {
    flex: 1,
    minHeight: 160,
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTitle: {
    marginTop: 13,
    fontSize: 16,
    fontWeight: '700',
  },
  actionText: {
    marginTop: 5,
    fontSize: 12,
    lineHeight: 17,
  },
});
