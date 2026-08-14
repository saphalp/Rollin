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
import { createWantedRequest } from '@/services/ride-wanted-requests-service';
import { supabase } from '@/lib/supabase';

type LinkedActivity = {
  id: string;
  title: string;
  location: string | null;
};

export default function RequestRideScreen() {
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
        'Please enter where you’d like to be picked up.',
      );
      return;
    }

    if (!cleanedDestination) {
      Alert.alert(
        'Missing destination',
        'Please enter where you need to go.',
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

    if (!rideDateTime) {
      Alert.alert(
        'Missing departure time',
        'Please select a date and time you need the ride.',
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
      await createWantedRequest({
        activityId: linkedActivity?.id ?? null,
        pickupLocation: cleanedPickup,
        destination: cleanedDestination,
        dateTime: rideDateTime.toISOString(),
        notes: notes.trim() || null,
      });

      Alert.alert(
        'Ride request posted',
        'Drivers will be able to see your request and offer you a ride.',
        [
          {
            text: 'OK',
            onPress: () => router.replace('/(tabs)/rides'),
          },
        ],
      );
    } catch (error) {
      Alert.alert(
        'Could not post request',
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
      <OfferRideHeader
        onBack={goBack}
        title="Request a Ride"
        subtitle="Let drivers know you need a lift"
      />

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
            icon="car-search-outline"
            defaultTitle="Request a ride"
            defaultSubtitle="Post a general trip request or connect it to a public activity."
            linkedSubtitle="This request will be connected to the selected activity."
          />

          <OfferRideForm
            pickupLocation={pickupLocation}
            onPickupLocationChange={setPickupLocation}
            destination={destination}
            onDestinationChange={setDestination}
            rideDateTime={rideDateTime}
            onRideDateTimeChange={setRideDateTime}
            notes={notes}
            onNotesChange={setNotes}
            saving={saving}
            onSubmit={handleSubmit}
            submitLabel="Post Ride Request"
            savingLabel="Posting..."
            pickupPlaceholder="Where would you like to be picked up?"
            destinationPlaceholder="Where are you headed?"
            notesPlaceholder="Anything a driver should know..."
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
