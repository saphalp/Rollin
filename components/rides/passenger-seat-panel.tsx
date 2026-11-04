import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/text';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { RideOffer, RideRequest } from '@/types/rides';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

type PassengerSeatPanelProps = {
  ride: RideOffer;
  request: RideRequest;
};

/** The passenger's own seat on a ride: where it stands and where they'll be picked up. */
export function PassengerSeatPanel({ ride, request }: PassengerSeatPanelProps) {
  const theme = useColorScheme() ?? 'light';
  const colors = Colors[theme];
  const driverFirstName = ride.driver.name.split(' ')[0];

  const onTheWay = request.status === 'accepted' && ride.status === 'in_progress';
  const state: { icon: IconName; chip: string; title: string; message: string; chipBg: string; chipFg: string } =
    onTheWay
      ? {
        icon: 'car-arrow-right',
        chip: 'On the way',
        title: `${driverFirstName} is on the way`,
        message: 'Track the drive to see when they’ll reach you.',
        chipBg: colors.tint,
        chipFg: colors.onPrimary,
      }
      : request.status === 'accepted'
        ? {
          icon: 'check-decagram',
          chip: 'Confirmed',
          title: 'Your seat is confirmed',
          message: `${driverFirstName} will pick you up at the departure time.`,
          chipBg: colors.verifiedContainer,
          chipFg: colors.onVerifiedContainer,
        }
        : {
          icon: 'clock-outline',
          chip: 'Pending',
          title: 'Request sent',
          message: `Waiting for ${driverFirstName} to accept your request.`,
          chipBg: colors.secondaryContainer,
          chipFg: colors.onSecondaryContainer,
        };

  return (
    <View style={[styles.panel, { backgroundColor: colors.cardBackground, borderColor: colors.outlineVariant }]}>
      <View style={styles.header}>
        <View style={[styles.icon, { backgroundColor: colors.surfaceContainer }]}>
          <MaterialCommunityIcons name={state.icon} size={22} color={colors.tint} />
        </View>
        <View style={styles.headerText}>
          <AppText style={[styles.label, { color: colors.icon, fontFamily: Fonts?.sans }]}>Your driver</AppText>
          <AppText style={[styles.title, { color: colors.text, fontFamily: Fonts?.sans }]}>{state.title}</AppText>
        </View>
        <View style={[styles.chip, { backgroundColor: state.chipBg }]}>
          <AppText style={[styles.chipText, { color: state.chipFg, fontFamily: Fonts?.sans }]}>{state.chip}</AppText>
        </View>
      </View>

      <AppText style={[styles.message, { color: colors.icon, fontFamily: Fonts?.sans }]}>{state.message}</AppText>

      <View style={[styles.pickup, { backgroundColor: colors.surfaceContainer }]}>
        <MaterialCommunityIcons name="map-marker-account-outline" size={20} color={colors.tint} />
        <View style={styles.pickupText}>
          <AppText style={[styles.label, { color: colors.icon, fontFamily: Fonts?.sans }]}>Your pickup</AppText>
          <AppText style={[styles.pickupAddress, { color: colors.text, fontFamily: Fonts?.sans }]}>
            {request.pickupAddress || ride.pickupLocation || 'Pickup address not set'}
          </AppText>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
  },
  label: {
    fontSize: 12,
    lineHeight: 16,
  },
  title: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '700',
  },
  chip: {
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  chipText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
  },
  pickup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    padding: 12,
  },
  pickupText: {
    flex: 1,
  },
  pickupAddress: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
  },
});
