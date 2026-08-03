import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OfferRideForm } from '@/components/rides/offer/offer-ride-form';
import { OfferRideHeader } from '@/components/rides/offer/offer-ride-header';
import { OfferRideIntroCard } from '@/components/rides/offer/offer-ride-intro-card';
import { AppView } from '@/components/view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { supabase } from '@/lib/supabase';

type LinkedActivity = {
  id: string;
  title: string;
  location: string | null;
};

export default function OfferRideScreen() {
  const theme = useColorScheme() ?? 'light';
  const colors = Colors[theme];
  const insets = useSafeAreaInsets();

  const { activityId } = useLocalSearchParams<{
    activityId?: string;
  }>();

  const [linkedActivity, setLinkedActivity] = useState<LinkedActivity | null>(null);
  const [pickupLocation, setPickupLocation] = useState('');
  const [destination, setDestination] = useState('');
  const [rideDateTime, setRideDateTime] = useState<Date | null>(null);
  const [availableSeats, setAvailableSeats] = useState('1');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!activityId) {
      setLinkedActivity(null);
      return;
    }

    let cancelled = false;

    (async () => {
      const { data, error } = await supabase
        .from('activities')
        .select('id, title, location')
        .eq('id', activityId)
        .single();

      if (cancelled || error || !data) return;

      setLinkedActivity(data);
      if (data.location) setDestination(data.location);
    })();

    return () => {
      cancelled = true;
    };
  }, [activityId]);

  function goBack() {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/(tabs)/rides');
  }

  async function handleSubmit() {
    if (!pickupLocation.trim()) {
      Alert.alert('Missing pickup location', 'Please enter where riders should meet you.');
      return;
    }
    if (!destination.trim()) {
      Alert.alert('Missing destination', 'Please enter where this ride is headed.');
      return;
    }
    const seats = parseInt(availableSeats, 10);
    if (!availableSeats.trim() || isNaN(seats) || seats < 1) {
      Alert.alert('Invalid seats', 'Enter how many seats you have available (1 or more).');
      return;
    }

    setSaving(true);

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      Alert.alert('Not logged in', 'Please log in to offer a ride.');
      setSaving(false);
      return;
    }

    const { error } = await supabase.from('rides_offered').insert({
      driver_id: user.id,
      activity_id: linkedActivity?.id ?? null,
      pickup_location: pickupLocation.trim(),
      destination: destination.trim(),
      date_time: rideDateTime ? rideDateTime.toISOString() : null,
      available_seats: seats,
      notes: notes.trim() || null,
    });

    setSaving(false);

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

    Alert.alert('Ride offer posted', 'Your ride is now visible to riders.', [
      { text: 'OK', onPress: () => router.replace('/(tabs)/rides') },
    ]);
  }

  return (
    <AppView style={[styles.container, { backgroundColor: colors.background }]}>
      <OfferRideHeader onBack={goBack} />

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        >
          <OfferRideIntroCard linkedActivityTitle={linkedActivity?.title} />

          <OfferRideForm
            pickupLocation={pickupLocation}
            onPickupLocationChange={setPickupLocation}
            destination={destination}
            onDestinationChange={setDestination}
            rideDateTime={rideDateTime}
            onRideDateTimeChange={setRideDateTime}
            availableSeats={availableSeats}
            onAvailableSeatsChange={setAvailableSeats}
            notes={notes}
            onNotesChange={setNotes}
            saving={saving}
            onSubmit={handleSubmit}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </AppView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 18,
  },
});
