import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OfferRideForm } from '@/components/rides/offer/offer-ride-form';
import { OfferRideHeader } from '@/components/rides/offer/offer-ride-header';
import { OfferRideIntroCard } from '@/components/rides/offer/offer-ride-intro-card';
import { AppView } from '@/components/view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { supabase } from '@/lib/supabase';
import { geocodeAddress } from '@/services/geocoding-service';

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

  const [linkedActivity, setLinkedActivity] =
    useState<LinkedActivity | null>(null);

  const [pickupLocation, setPickupLocation] = useState('');
  const [destination, setDestination] = useState('');
  const [rideDateTime, setRideDateTime] =
    useState<Date | null>(null);
  const [availableSeats, setAvailableSeats] = useState('1');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!activityId) {
      setLinkedActivity(null);
      return;
    }

    let cancelled = false;

    async function loadActivity() {
      const { data, error } = await supabase
        .from('activities')
        .select('id, title, location')
        .eq('id', activityId)
        .single();

      if (cancelled || error || !data) {
        return;
      }

      setLinkedActivity(data);

      if (data.location) {
        setDestination(data.location);
      }
    }

    void loadActivity();

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
    const cleanedPickup = pickupLocation.trim();
    const cleanedDestination = destination.trim();

    if (!cleanedPickup) {
      Alert.alert(
        'Missing pickup location',
        'Please enter where riders should meet you.',
      );
      return;
    }

    if (!cleanedDestination) {
      Alert.alert(
        'Missing destination',
        'Please enter where this ride is headed.',
      );
      return;
    }

    if (
      cleanedPickup.toLowerCase() ===
      cleanedDestination.toLowerCase()
    ) {
      Alert.alert(
        'Invalid route',
        'Pickup and destination must be different.',
      );
      return;
    }

    const seats = Number.parseInt(availableSeats, 10);

    if (
      !availableSeats.trim() ||
      Number.isNaN(seats) ||
      seats < 1
    ) {
      Alert.alert(
        'Invalid seats',
        'Enter how many seats you have available.',
      );
      return;
    }

    if (!rideDateTime) {
      Alert.alert(
        'Missing departure time',
        'Please select a departure date and time.',
      );
      return;
    }

    if (rideDateTime.getTime() <= Date.now()) {
      Alert.alert(
        'Invalid departure time',
        'Departure time must be in the future.',
      );
      return;
    }

    setSaving(true);

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) {
        throw new Error(authError.message);
      }

      if (!user) {
        throw new Error('Please log in to offer a ride.');
      }

      const [pickupCoordinates, destinationCoordinates] =
        await Promise.all([
          geocodeAddress(cleanedPickup),
          geocodeAddress(cleanedDestination),
        ]);

      const { error } = await supabase
        .from('rides_offered')
        .insert({
          driver_id: user.id,
          activity_id: linkedActivity?.id ?? null,

          pickup_location: cleanedPickup,
          pickup_latitude: pickupCoordinates.latitude,
          pickup_longitude: pickupCoordinates.longitude,

          destination: cleanedDestination,
          destination_latitude:
            destinationCoordinates.latitude,
          destination_longitude:
            destinationCoordinates.longitude,

          date_time: rideDateTime.toISOString(),
          available_seats: seats,
          notes: notes.trim() || null,
          status: 'open',
        });

      if (error) {
        throw new Error(error.message);
      }

      Alert.alert(
        'Ride offer posted',
        'Your ride and map locations were saved successfully.',
        [
          {
            text: 'OK',
            onPress: () => router.replace('/(tabs)/rides'),
          },
        ],
      );
    } catch (error) {
      Alert.alert(
        'Could not post ride',
        error instanceof Error
          ? error.message
          : 'Something went wrong.',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppView
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
        },
      ]}
    >
      <OfferRideHeader onBack={goBack} />

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={
          Platform.OS === 'ios' ? 80 : 0
        }
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={[
            styles.content,
            {
              paddingBottom: insets.bottom + 32,
            },
          ]}
        >
          <OfferRideIntroCard
            linkedActivityTitle={linkedActivity?.title}
          />

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