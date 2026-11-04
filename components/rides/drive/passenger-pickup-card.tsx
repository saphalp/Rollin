import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from 'react-native';

import { AppText } from '@/components/text';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { RidePassenger } from '@/services/offerer-ride-requests-service';

type PassengerPickupCardProps = {
  passenger: RidePassenger;
  /** 1-based position among passengers still to pick up; null once picked up. */
  stopNumber: number | null;
  isNext: boolean;
  busy: boolean;
  onPickedUp: () => void;
  onMoveUp?: () => void;
};

export function PassengerPickupCard({
  passenger,
  stopNumber,
  isNext,
  busy,
  onPickedUp,
  onMoveUp,
}: PassengerPickupCardProps) {
  const theme = useColorScheme() ?? 'light';
  const colors = Colors[theme];
  const pickedUp = Boolean(passenger.pickedUpAt);

  const pickedUpTime = passenger.pickedUpAt
    ? new Date(passenger.pickedUpAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    : null;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.cardBackground,
          borderColor: isNext ? colors.tint : colors.outlineVariant,
          borderWidth: isNext ? 2 : 1,
          opacity: pickedUp ? 0.75 : 1,
        },
      ]}
    >
      <View style={styles.header}>
        <View>
          <Image source={{ uri: passenger.avatarUrl }} style={styles.avatar} contentFit="cover" />
          {stopNumber !== null && (
            <View style={[styles.stopBadge, { backgroundColor: isNext ? colors.tint : colors.surfaceContainerHigh, borderColor: colors.cardBackground }]}>
              <AppText style={[styles.stopText, { color: isNext ? colors.onPrimary : colors.text, fontFamily: Fonts?.sans }]}>
                {stopNumber}
              </AppText>
            </View>
          )}
        </View>

        <View style={styles.headerText}>
          <AppText numberOfLines={1} style={[styles.name, { color: colors.text, fontFamily: Fonts?.sans }]}>
            {passenger.name}
          </AppText>
          <View style={styles.addressRow}>
            <MaterialCommunityIcons name="map-marker-outline" size={15} color={colors.icon} />
            <AppText numberOfLines={2} style={[styles.address, { color: colors.icon, fontFamily: Fonts?.sans }]}>
              {passenger.pickupAddress || 'Pickup address not set'}
            </AppText>
          </View>
        </View>

        {pickedUp ? (
          <View style={[styles.chip, { backgroundColor: colors.verifiedContainer }]}>
            <MaterialCommunityIcons name="check-circle" size={14} color={colors.onVerifiedContainer} />
            <AppText style={[styles.chipText, { color: colors.onVerifiedContainer, fontFamily: Fonts?.sans }]}>
              {pickedUpTime}
            </AppText>
          </View>
        ) : isNext ? (
          <View style={[styles.chip, { backgroundColor: colors.tint }]}>
            <AppText style={[styles.chipText, { color: colors.onPrimary, fontFamily: Fonts?.sans }]}>Next</AppText>
          </View>
        ) : null}
      </View>

      {!pickedUp && (
        <View style={styles.actions}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`Mark ${passenger.name} as picked up`}
            disabled={busy}
            onPress={onPickedUp}
            style={[
              styles.pickupButton,
              isNext
                ? { backgroundColor: colors.tint }
                : { borderWidth: 1, borderColor: colors.tint },
              busy && styles.disabled,
            ]}
          >
            {busy ? (
              <ActivityIndicator color={isNext ? colors.onPrimary : colors.tint} />
            ) : (
              <>
                <MaterialCommunityIcons name="account-check-outline" size={19} color={isNext ? colors.onPrimary : colors.tint} />
                <AppText style={[styles.pickupText, { color: isNext ? colors.onPrimary : colors.tint, fontFamily: Fonts?.sans }]}>
                  Mark as picked up
                </AppText>
              </>
            )}
          </TouchableOpacity>

          {onMoveUp && (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={`Pick up ${passenger.name} earlier`}
              disabled={busy}
              onPress={onMoveUp}
              style={[styles.iconButton, { borderColor: colors.outlineVariant }, busy && styles.disabled]}
            >
              <MaterialCommunityIcons name="arrow-up" size={20} color={colors.icon} />
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    padding: 14,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  stopBadge: {
    position: 'absolute',
    left: -4,
    top: -4,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  stopText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
  },
  headerText: {
    flex: 1,
    gap: 3,
  },
  name: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '700',
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
  },
  address: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  chipText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  pickupButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  pickupText: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
  },
  iconButton: {
    width: 46,
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.6,
  },
});
