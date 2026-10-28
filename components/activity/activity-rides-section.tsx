import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from 'react-native';

import { AppText } from '@/components/text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { openRideDetails } from '@/navigation/ride-navigation';
import { fetchAvailableRides, subscribeToRideOffers } from '@/services/rides-service';
import { RideOffer } from '@/types/rides';

// "6:40 PM" from a ride's departure time.
function formatTime(iso: string | null) {
  if (!iso) return 'Time TBD';
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? 'Time TBD'
    : date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

// Driver initials for when there's no profile picture.
function initialsOf(name: string) {
  return name.trim().split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

// Ride sharing card on the activity page: drivers, seats left, and Join buttons.
export function ActivityRidesSection({ activityId }: { activityId: string }) {
  const colors = Colors[useColorScheme() ?? 'light'];
  const [rides, setRides] = useState<RideOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  // Load rides for this activity, and reload when rides change.
  useFocusEffect(useCallback(() => {
    let active = true;
    let latest = 0;
    setLoading(true);
    setRides([]);
    async function load() {
      const request = ++latest;
      try {
        const result = await fetchAvailableRides({ activityId, includeOwn: true });
        if (active && request === latest) {
          setRides(result);
          setError(false);
        }
      } catch {
        if (active && request === latest) setError(true);
      } finally {
        if (active && request === latest) setLoading(false);
      }
    }
    void load();
    const unsubscribe = subscribeToRideOffers(() => { void load(); });
    return () => { active = false; unsubscribe(); };
  // Retry deliberately recreates the focused subscription and reloads the preview.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activityId, attempt]));

  return (
    <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.outlineVariant }]}>
      {/* Blue header with Request a Ride */}
      <View style={[styles.header, { backgroundColor: colors.tint }]}>
        <View style={styles.headerTitleRow}>
          <IconSymbol name="car.fill" size={20} color={colors.onPrimary} />
          <AppText accessibilityRole="header" style={[styles.headerTitle, { color: colors.onPrimary, fontFamily: Fonts?.sans }]}>
            Ride Sharing
          </AppText>
        </View>
        <TouchableOpacity
          onPress={() => router.push({ pathname: '/ride/request', params: { activityId } })}
          style={[styles.headerButton, { backgroundColor: colors.primaryContainer }]}
        >
          <AppText style={[styles.headerButtonText, { color: colors.onPrimary, fontFamily: Fonts?.sans }]}>
            Request a Ride
          </AppText>
        </TouchableOpacity>
      </View>

      <View style={styles.body}>
        {loading ? (
          <ActivityIndicator accessibilityLabel="Loading activity rides" color={colors.tint} />
        ) : error ? (
          <TouchableOpacity onPress={() => setAttempt((value) => value + 1)}>
            <AppText accessibilityRole="alert" style={{ color: colors.error }}>
              Could not load rides. Tap to retry.
            </AppText>
          </TouchableOpacity>
        ) : rides.length === 0 ? (
          <AppText style={[styles.empty, { color: colors.icon, fontFamily: Fonts?.sans }]}>
            No rides offered yet. Request a ride so drivers know you need one.
          </AppText>
        ) : (
          // Show up to 3 drivers
          rides.slice(0, 3).map((ride, index) => (
            <View key={ride.id}>
              {index > 0 && <View style={[styles.divider, { backgroundColor: colors.outlineVariant }]} />}
              <TouchableOpacity style={styles.rideRow} onPress={() => openRideDetails(ride.id)}>
                {ride.driver.avatarUrl?.startsWith('http') ? (
                  <Image source={{ uri: ride.driver.avatarUrl }} style={styles.avatar} contentFit="cover" />
                ) : (
                  <View style={[styles.avatar, styles.initials, { backgroundColor: colors.secondaryContainer }]}>
                    <AppText style={[styles.initialsText, { color: colors.onSecondaryContainer }]}>
                      {initialsOf(ride.driver.name)}
                    </AppText>
                  </View>
                )}

                {/* Driver, time, and pickup */}
                <View style={styles.rideText}>
                  <AppText numberOfLines={1} style={[styles.driverName, { color: colors.text, fontFamily: Fonts?.sans }]}>
                    {ride.driver.name}
                  </AppText>
                  <AppText style={[styles.leaving, { color: colors.text, fontFamily: Fonts?.sans }]}>
                    Leaving at {formatTime(ride.dateTime)}
                  </AppText>
                  <AppText numberOfLines={1} style={[styles.pickup, { color: colors.icon, fontFamily: Fonts?.sans }]}>
                    Pickup: {ride.pickupLocation}
                  </AppText>
                </View>

                {/* Seats left + Join */}
                <View style={styles.rideActions}>
                  <View style={[styles.seatsPill, { backgroundColor: colors.errorContainer }]}>
                    <AppText style={[styles.seatsText, { color: colors.error, fontFamily: Fonts?.sans }]}>
                      {ride.availableSeats} {ride.availableSeats === 1 ? 'seat' : 'seats'} left
                    </AppText>
                  </View>
                  <View style={styles.joinRow}>
                    <AppText style={[styles.join, { color: colors.tint, fontFamily: Fonts?.sans }]}>Join</AppText>
                    <IconSymbol name="chevron.right" size={16} color={colors.tint} />
                  </View>
                </View>
              </TouchableOpacity>
            </View>
          ))
        )}

        {/* Footer links */}
        <View style={styles.footer}>
          <TouchableOpacity onPress={() => router.push({ pathname: '/ride/offer', params: { activityId } })}>
            <AppText style={[styles.footerLink, { color: colors.tint, fontFamily: Fonts?.sans }]}>Offer a Ride</AppText>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push({ pathname: '/ride/available', params: { activityId, rideType: 'activity' } })}>
            <AppText style={[styles.footerLink, { color: colors.tint, fontFamily: Fonts?.sans }]}>View all rides</AppText>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 18, lineHeight: 24, fontWeight: '700' },
  headerButton: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6 },
  headerButtonText: { fontSize: 13, lineHeight: 17, fontWeight: '700' },
  body: { padding: 16, gap: 12 },
  empty: { fontSize: 14, lineHeight: 20 },
  divider: { height: StyleSheet.hairlineWidth, marginBottom: 12 },
  rideRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  initials: { alignItems: 'center', justifyContent: 'center' },
  initialsText: { fontSize: 14, lineHeight: 18, fontWeight: '700' },
  rideText: { flex: 1, gap: 2 },
  driverName: { fontSize: 15, lineHeight: 20, fontWeight: '600' },
  leaving: { fontSize: 13, lineHeight: 17, fontWeight: '700' },
  pickup: { fontSize: 12, lineHeight: 16 },
  rideActions: { alignItems: 'flex-end', gap: 6 },
  seatsPill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  seatsText: { fontSize: 11, lineHeight: 15, fontWeight: '700' },
  joinRow: { flexDirection: 'row', alignItems: 'center' },
  join: { fontSize: 14, lineHeight: 18, fontWeight: '700' },
  footer: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 4 },
  footerLink: { fontSize: 14, lineHeight: 18, fontWeight: '600' },
});