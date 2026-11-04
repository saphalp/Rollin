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
    <View style={styles.actionList}>
      <TouchableOpacity
        accessibilityRole="button"
        onPress={onFindRide}
        style={[styles.actionCard, { backgroundColor: colors.tint, borderColor: colors.tint }]}
      >
        <View style={[styles.actionIcon, { backgroundColor: colors.onPrimary }]}>
          <MaterialCommunityIcons name="car-search-outline" size={26} color={colors.tint} />
        </View>

        <View style={styles.actionBody}>
          <AppText style={[styles.actionTitle, { color: colors.onPrimary, fontFamily: Fonts?.sans }]}>
            Find a Ride
          </AppText>
          <AppText style={[styles.actionText, { color: colors.onPrimary, fontFamily: Fonts?.sans }]}>
            Grab a seat, or request one if no ride fits.
          </AppText>
        </View>

        <MaterialCommunityIcons name="chevron-right" size={24} color={colors.onPrimary} />
      </TouchableOpacity>

      <TouchableOpacity
        accessibilityRole="button"
        onPress={onOfferRide}
        style={[styles.actionCard, { backgroundColor: colors.cardBackground, borderColor: colors.outlineVariant }]}
      >
        <View style={[styles.actionIcon, { backgroundColor: colors.surfaceContainer }]}>
          <MaterialCommunityIcons name="car-multiple" size={26} color={colors.tint} />
        </View>

        <View style={styles.actionBody}>
          <AppText style={[styles.actionTitle, { color: colors.text, fontFamily: Fonts?.sans }]}>
            Offer a Ride
          </AppText>
          <AppText style={[styles.actionText, { color: colors.icon, fontFamily: Fonts?.sans }]}>
            Driving somewhere? Share your empty seats.
          </AppText>
        </View>

        <MaterialCommunityIcons name="chevron-right" size={24} color={colors.tabIconDefault} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  actionList: {
    gap: 12,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 92,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  actionIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBody: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
  },
  actionText: {
    marginTop: 3,
    fontSize: 13,
    lineHeight: 18,
  },
});
