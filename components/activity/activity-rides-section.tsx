import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Button } from 'react-native-paper';

import { AvailableRideCard } from '@/components/rides/available-ride-card';
import { AppText } from '@/components/text';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { openRideDetails } from '@/navigation/ride-navigation';
import { fetchAvailableRides, subscribeToRideOffers } from '@/services/rides-service';
import { RideOffer } from '@/types/rides';

export function ActivityRidesSection({ activityId }: { activityId: string }) {
  const colors = Colors[useColorScheme() ?? 'light'];
  const [rides, setRides] = useState<RideOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

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
    <View style={[styles.section, { backgroundColor: colors.cardBackground, borderColor: colors.outlineVariant }]}>
      <AppText accessibilityRole="header" style={[styles.heading, { color: colors.text }]}>Rides for this activity</AppText>
      <AppText style={[styles.description, { color: colors.icon }]}>Find a seat or let drivers know you need a lift.</AppText>
      <View style={styles.actions}>
        <Button style={styles.action} contentStyle={styles.actionContent} labelStyle={styles.actionLabel} buttonColor={colors.tint} textColor={colors.onPrimary} mode="contained" onPress={() => router.push({ pathname: '/ride/request', params: { activityId } })}>Request a Ride</Button>
        <Button style={[styles.action, { borderColor: colors.tint }]} contentStyle={styles.actionContent} labelStyle={styles.actionLabel} textColor={colors.tint} mode="outlined" onPress={() => router.push({ pathname: '/ride/offer', params: { activityId } })}>Offer a Ride</Button>
      </View>
      {loading ? <ActivityIndicator accessibilityLabel="Loading activity rides" color={colors.tint} /> : error ? (
        <View>
          <AppText accessibilityRole="alert" style={{ color: colors.error }}>Could not load rides for this activity.</AppText>
          <Button textColor={colors.tint} labelStyle={styles.actionLabel} onPress={() => setAttempt(value => value + 1)}>Retry</Button>
        </View>
      ) : rides.length === 0 ? (
        <AppText style={{ color: colors.outline }}>No upcoming rides with available seats yet. Request a ride so drivers know you need one.</AppText>
      ) : rides.slice(0, 3).map(ride => (
        <AvailableRideCard key={ride.id} ride={ride} onPress={() => openRideDetails(ride.id)} />
      ))}
      <Button textColor={colors.tint} labelStyle={styles.actionLabel} onPress={() => router.push({ pathname: '/ride/available', params: { activityId, rideType: 'activity' } })}>View all rides and requests</Button>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 20, padding: 16, borderRadius: 20, borderWidth: 1, gap: 16 },
  description: { fontSize: 14, lineHeight: 21 },
  action: { borderRadius: 14, flexGrow: 1, flexBasis: 140 },
  actionContent: { minHeight: 50 },
  actionLabel: { fontSize: 14, fontWeight: '700', textAlign: 'center', includeFontPadding: false },
  heading: { fontSize: 20, fontWeight: '700' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
