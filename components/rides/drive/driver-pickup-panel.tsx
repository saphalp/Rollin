import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, TouchableOpacity, View } from 'react-native';

import { PassengerPickupCard } from '@/components/rides/drive/passenger-pickup-card';
import { AppText } from '@/components/text';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  fetchRidePassengers,
  markPassengerPickedUp,
  RidePassenger,
  setPickupOrder,
} from '@/services/offerer-ride-requests-service';
import { openGoogleMaps } from '@/services/ride-navigation-service';
import type { RoadRoute } from '@/services/ride-routing-service';

type DriverPickupPanelProps = {
  rideId: string;
  destination: string;
  route: RoadRoute | null;
  /** Recalculates the route; optimize reorders the remaining pickups. */
  refreshRoute: (optimize?: boolean) => Promise<void>;
  completing: boolean;
  onComplete: () => void;
};

function sortRemaining(passengers: RidePassenger[], route: RoadRoute | null) {
  // The route's stop order is the driving order; fall back to the saved order.
  const routeOrder = new Map(
    (route?.stops ?? [])
      .filter((stop) => stop.requestId)
      .map((stop, index) => [stop.requestId as string, index]),
  );
  return [...passengers].sort((a, b) =>
    (routeOrder.get(a.requestId) ?? Infinity) - (routeOrder.get(b.requestId) ?? Infinity)
    || (a.pickupOrder ?? Infinity) - (b.pickupOrder ?? Infinity)
    || (a.createdAt ?? '').localeCompare(b.createdAt ?? ''),
  );
}

export function DriverPickupPanel({
  rideId,
  destination,
  route,
  refreshRoute,
  completing,
  onComplete,
}: DriverPickupPanelProps) {
  const theme = useColorScheme() ?? 'light';
  const colors = Colors[theme];

  const [passengers, setPassengers] = useState<RidePassenger[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  // requestId being picked up, 'order' while reordering, or null.
  const [busy, setBusy] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setPassengers(await fetchRidePassengers(rideId));
      setLoadError(null);
    } catch {
      setLoadError('Could not load your passengers. Tap to retry.');
    }
  }, [rideId]);

  useEffect(() => {
    let active = true;
    fetchRidePassengers(rideId)
      .then((result) => { if (active) setPassengers(result); })
      .catch(() => { if (active) setLoadError('Could not load your passengers. Tap to retry.'); });
    return () => { active = false; };
  }, [rideId]);

  async function run(key: string, work: () => Promise<void>) {
    if (busy) return;
    setBusy(key);
    try {
      await work();
    } catch (error) {
      Alert.alert('Could not update pickups', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setBusy(null);
    }
  }

  const remaining = sortRemaining((passengers ?? []).filter((p) => !p.pickedUpAt), route);
  const pickedUp = (passengers ?? [])
    .filter((p) => p.pickedUpAt)
    .sort((a, b) => (a.pickedUpAt ?? '').localeCompare(b.pickedUpAt ?? ''));
  const total = passengers?.length ?? 0;
  const allAboard = passengers !== null && remaining.length === 0;

  // Remaining pickups plus the destination, in driving order.
  const remainingIds = new Set(remaining.map((p) => p.requestId));
  const navigationStops = (route?.stops ?? []).filter((stop) => !stop.requestId || remainingIds.has(stop.requestId));

  function confirmPickedUp(passenger: RidePassenger) {
    Alert.alert(
      `Picked up ${passenger.name}?`,
      passenger.pickupAddress ? `At ${passenger.pickupAddress}` : undefined,
      [
        { text: 'Not yet', style: 'cancel' },
        {
          text: 'Picked up',
          onPress: () => void run(passenger.requestId, async () => {
            await markPassengerPickedUp(passenger.requestId);
            await Promise.all([reload(), refreshRoute()]);
          }),
        },
      ],
    );
  }

  function moveUp(index: number) {
    const ids = remaining.map((p) => p.requestId);
    [ids[index - 1], ids[index]] = [ids[index], ids[index - 1]];
    void run('order', async () => {
      await setPickupOrder(rideId, ids);
      await Promise.all([reload(), refreshRoute()]);
    });
  }

  function confirmComplete() {
    Alert.alert('Complete ride?', 'Confirm everyone has arrived. You can rate your passengers next.', [
      { text: 'Not yet', style: 'cancel' },
      { text: 'Complete ride', onPress: onComplete },
    ]);
  }

  if (passengers === null) {
    return loadError ? (
      <TouchableOpacity accessibilityRole="button" onPress={() => void reload()}>
        <AppText style={[styles.muted, { color: colors.error, fontFamily: Fonts?.sans }]}>{loadError}</AppText>
      </TouchableOpacity>
    ) : (
      <ActivityIndicator color={colors.tint} />
    );
  }

  return (
    <View style={styles.panel}>
      <View style={[styles.progressCard, { backgroundColor: colors.cardBackground, borderColor: colors.outlineVariant }]}>
        <View style={styles.progressHeader}>
          <AppText style={[styles.progressTitle, { color: colors.text, fontFamily: Fonts?.sans }]}>
            {total === 0 ? 'No passengers' : allAboard ? 'Everyone is on board' : 'Pickups'}
          </AppText>
          {total > 0 && (
            <AppText style={[styles.muted, { color: colors.icon, fontFamily: Fonts?.sans }]}>
              {pickedUp.length} of {total} picked up
            </AppText>
          )}
        </View>
        {total > 0 && (
          <View style={[styles.track, { backgroundColor: colors.surfaceContainerHigh }]}>
            <View style={[styles.fill, { backgroundColor: colors.tint, width: `${(pickedUp.length / total) * 100}%` }]} />
          </View>
        )}

        {navigationStops.length > 0 && (
          <TouchableOpacity
            accessibilityRole="button"
            disabled={Boolean(busy)}
            onPress={() => void run('navigate', () => openGoogleMaps(navigationStops))}
            style={[styles.primaryButton, { backgroundColor: colors.tint }, busy && styles.disabled]}
          >
            <MaterialCommunityIcons name="navigation-variant" size={19} color={colors.onPrimary} />
            <AppText style={[styles.primaryText, { color: colors.onPrimary, fontFamily: Fonts?.sans }]}>
              {allAboard ? 'Navigate to destination' : 'Navigate to next pickup'}
            </AppText>
          </TouchableOpacity>
        )}
      </View>

      {remaining.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <AppText style={[styles.sectionTitle, { color: colors.text, fontFamily: Fonts?.sans }]}>To pick up</AppText>
            {remaining.length > 1 && (
              <TouchableOpacity
                accessibilityRole="button"
                disabled={Boolean(busy)}
                onPress={() => void run('order', async () => { await refreshRoute(true); await reload(); })}
                hitSlop={8}
              >
                <AppText style={[styles.link, { color: colors.tint, fontFamily: Fonts?.sans }]}>
                  {busy === 'order' ? 'Updating…' : 'Optimize order'}
                </AppText>
              </TouchableOpacity>
            )}
          </View>
          {remaining.map((passenger, index) => (
            <PassengerPickupCard
              key={passenger.requestId}
              passenger={passenger}
              stopNumber={index + 1}
              isNext={index === 0}
              busy={busy === passenger.requestId || busy === 'order'}
              onPickedUp={() => confirmPickedUp(passenger)}
              onMoveUp={index > 0 ? () => moveUp(index) : undefined}
            />
          ))}
        </View>
      )}

      {pickedUp.length > 0 && (
        <View style={styles.section}>
          <AppText style={[styles.sectionTitle, { color: colors.text, fontFamily: Fonts?.sans }]}>In the car</AppText>
          {pickedUp.map((passenger) => (
            <PassengerPickupCard
              key={passenger.requestId}
              passenger={passenger}
              stopNumber={null}
              isNext={false}
              busy={false}
              onPickedUp={() => {}}
            />
          ))}
        </View>
      )}

      {allAboard && (
        <View style={[styles.destinationCard, { backgroundColor: colors.surfaceContainer }]}>
          <MaterialCommunityIcons name="flag-checkered" size={22} color={colors.tint} />
          <View style={styles.destinationText}>
            <AppText style={[styles.muted, { color: colors.icon, fontFamily: Fonts?.sans }]}>Destination</AppText>
            <AppText style={[styles.destinationName, { color: colors.text, fontFamily: Fonts?.sans }]}>{destination}</AppText>
          </View>
        </View>
      )}

      {allAboard && (
        <TouchableOpacity
          accessibilityRole="button"
          disabled={completing}
          onPress={confirmComplete}
          style={[styles.primaryButton, { backgroundColor: colors.tint }, completing && styles.disabled]}
        >
          {completing ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <>
              <MaterialCommunityIcons name="check-circle-outline" size={20} color={colors.onPrimary} />
              <AppText style={[styles.primaryText, { color: colors.onPrimary, fontFamily: Fonts?.sans }]}>
                Complete ride
              </AppText>
            </>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: 16,
  },
  progressCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    gap: 12,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressTitle: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
  },
  track: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 4,
  },
  primaryButton: {
    minHeight: 50,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryText: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
  },
  section: {
    gap: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '700',
  },
  link: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '700',
  },
  muted: {
    fontSize: 13,
    lineHeight: 18,
  },
  destinationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    padding: 14,
  },
  destinationText: {
    flex: 1,
  },
  destinationName: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.6,
  },
});
