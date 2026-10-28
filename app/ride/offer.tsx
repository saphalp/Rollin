import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Text } from 'react-native-paper';

import { OfferRideForm } from '@/components/rides/offer/offer-ride-form';
import { OfferRideHeader } from '@/components/rides/offer/offer-ride-header';
import { OfferRideIntroCard } from '@/components/rides/offer/offer-ride-intro-card';
import { AppText } from '@/components/text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { AppView } from '@/components/view';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getDriverProfile } from '@/lib/profile/driver-profile';
import { supabase } from '@/lib/supabase';
import { geocodeAddress } from '@/services/geocoding-service';
import { fulfillWantedRequest } from '@/services/ride-wanted-requests-service';

type LinkedActivity = {
  id: string;
  title: string;
  location: string | null;
  date_time: string | null;
};

export default function OfferRideScreen() {
  const theme = useColorScheme() ?? 'light';
  const colors = Colors[theme];
  const insets = useSafeAreaInsets();

  const { activityId, pickupLocation: prefilledPickup, sourceRequestId } =
    useLocalSearchParams<{
      activityId?: string;
      pickupLocation?: string;
      sourceRequestId?: string;
    }>();

  const [linkedActivity, setLinkedActivity] =
    useState<LinkedActivity | null>(null);

  const [pickupLocation, setPickupLocation] = useState(prefilledPickup ?? '');
  const [individualPickup, setIndividualPickup] = useState(false);
  const [destination, setDestination] = useState('');
  const [rideDateTime, setRideDateTime] =
    useState<Date | null>(null);
  const [availableSeats, setAvailableSeats] = useState('1');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [activityError, setActivityError] = useState(false);
  const [activityAttempt, setActivityAttempt] = useState(0);
  const [selectedPickupPlace, setSelectedPickupPlace] = useState<{ latitude: number; longitude: number } | null>(null);
  const [selectedDestinationPlace, setSelectedDestinationPlace] = useState<{ latitude: number; longitude: number } | null>(null);

  const [verificationStatus, setVerificationStatus] = useState<string | null | 'loading'>('loading');

  useEffect(() => {
    let active = true;

    getDriverProfile()
      .then((row) => {
        if (!active) return;
        setVerificationStatus(row?.verification_status ?? null);
      })
      .catch((err) => {
        console.error('Unable to load driver verification status:', err);
        if (active) setVerificationStatus(null);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!activityId) {
      setLinkedActivity(null);
      return;
    }

    let cancelled = false;
    setLinkedActivity(null);
    setActivityError(false);

    async function loadActivity() {
      try {
        const { data, error } = await supabase
          .from('activities')
          .select('id, title, location, date_time')
          .eq('id', activityId)
          .single();

        if (cancelled) return;
        if (error || !data) throw new Error(error?.message ?? 'Activity unavailable');

        setLinkedActivity(data);
        setRideDateTime(null);

        if (data.location) {
          setDestination(data.location);
        }
      } catch {
        if (!cancelled) setActivityError(true);
      }
    }

    void loadActivity();

    return () => {
      cancelled = true;
    };
  }, [activityId, activityAttempt]);

  function goBack() {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/(tabs)/rides');
  }

  async function handleSubmit() {
    if (saving) return;
    if (activityId && linkedActivity?.id !== activityId) {
      Alert.alert('Activity unavailable', 'Load the activity before offering a ride.');
      return;
    }
    if (linkedActivity && (!linkedActivity.date_time || !Number.isFinite(new Date(linkedActivity.date_time).getTime()))) {
      Alert.alert('Activity date not set', 'The host needs to set a date for this activity before you can offer a ride.');
      return;
    }
    const cleanedPickup = pickupLocation.trim();
    const cleanedDestination = destination.trim();

    if (!individualPickup && !cleanedPickup) {
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
      !individualPickup && cleanedPickup.toLowerCase() ===
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

    const departure = new Date(linkedActivity?.date_time ?? rideDateTime);
    departure.setHours(rideDateTime.getHours(), rideDateTime.getMinutes(), 0, 0);
    if (!Number.isFinite(departure.getTime()) || departure.getTime() <= Date.now()) {
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
          individualPickup ? null : (selectedPickupPlace ?? geocodeAddress(cleanedPickup)),
          selectedDestinationPlace ?? geocodeAddress(cleanedDestination),
        ]);

      const { error } = await supabase
        .from('rides_offered')
        .insert({
          driver_id: user.id,
          activity_id: linkedActivity?.id ?? null,

          pickup_mode: individualPickup ? 'individual' : 'fixed',
          pickup_location: individualPickup ? null : cleanedPickup,
          pickup_latitude: pickupCoordinates?.latitude ?? null,
          pickup_longitude: pickupCoordinates?.longitude ?? null,

          destination: cleanedDestination,
          destination_latitude:
            destinationCoordinates.latitude,
          destination_longitude:
            destinationCoordinates.longitude,

          date_time: departure.toISOString(),
          available_seats: seats,
          notes: notes.trim() || null,
          status: 'open',
        });

      if (error) {
        throw new Error(error.message);
      }

      if (sourceRequestId) {
        try {
          await fulfillWantedRequest(sourceRequestId);
        } catch (fulfillError) {
          console.error('[offer] failed to mark request fulfilled:', fulfillError);
        }
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
          {verificationStatus === 'verified' ? (
            <>
              <OfferRideIntroCard
                linkedActivityTitle={linkedActivity?.title}
              />
              {linkedActivity?.date_time && Number.isFinite(new Date(linkedActivity.date_time).getTime()) && (
                <Text style={{ color: colors.text, fontSize: 16, lineHeight: 24 }}>
                  Event starts: {new Date(linkedActivity.date_time).toLocaleString(undefined, {
                    weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                  })}
                </Text>
              )}

              {activityId && !linkedActivity ? (
                <>
                  <Text style={{ color: colors.text }}>{activityError ? 'Could not load this activity. Check your connection and retry.' : 'Loading activity…'}</Text>
                  {activityError && <Button textColor={colors.tint} onPress={() => setActivityAttempt(value => value + 1)}>Retry</Button>}
                </>
              ) : linkedActivity && (!linkedActivity.date_time || !Number.isFinite(new Date(linkedActivity.date_time).getTime())) ? (
                <>
                  <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700' }}>Activity date not set</Text>
                  <Text style={{ color: colors.icon }}>The host needs to set a date for this activity before you can offer a ride.</Text>
                  <Button textColor={colors.tint} onPress={goBack}>Back to activity</Button>
                </>
              ) : <OfferRideForm
                fixedDate={linkedActivity?.date_time ? new Date(linkedActivity.date_time) : undefined}
                individualPickup={individualPickup}
                onIndividualPickupChange={setIndividualPickup}
                pickupLocation={pickupLocation}
                onPickupLocationChange={(text) => { setPickupLocation(text); setSelectedPickupPlace(null); }}
                onPickupPlaceSelect={(place) => { setPickupLocation(place.displayText); setSelectedPickupPlace(place); }}
                destination={destination}
                onDestinationChange={(text) => { setDestination(text); setSelectedDestinationPlace(null); }}
                onDestinationPlaceSelect={(place) => { setDestination(place.displayText); setSelectedDestinationPlace(place); }}
                destinationLocked={Boolean(activityId)}
                rideDateTime={rideDateTime}
                onRideDateTimeChange={setRideDateTime}
                availableSeats={availableSeats}
                onAvailableSeatsChange={setAvailableSeats}
                notes={notes}
                onNotesChange={setNotes}
                saving={saving}
                onSubmit={handleSubmit}
              />}
            </>
          ) : verificationStatus !== 'loading' ? (
            <View
              style={[
                styles.gateCard,
                { backgroundColor: colors.cardBackground, borderColor: colors.outlineVariant },
              ]}
            >
              <View style={[styles.gateIconCircle, { backgroundColor: colors.secondaryContainer }]}>
                <IconSymbol name="lock.fill" size={24} color={colors.onSecondaryContainer} />
              </View>

              <AppText style={[styles.gateTitle, { color: colors.text, fontFamily: Fonts?.sans }]}>
                Verify Your License to Offer Rides
              </AppText>

              <AppText style={[styles.gateBody, { color: colors.icon, fontFamily: Fonts?.sans }]}>
                Only verified drivers can offer rides. Finish registering as a driver and
                verifying your license in Edit Profile first.
              </AppText>

              <Button
                mode="contained"
                onPress={() => router.push('/edit-profile')}
                buttonColor={colors.tint}
                textColor={colors.onPrimary}
                style={styles.gateButton}
                contentStyle={styles.gateButtonContent}
              >
                Go to Edit Profile
              </Button>
            </View>
          ) : null}
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
  gateCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 24,
    gap: 12,
    alignItems: 'center',
  },
  gateIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  gateTitle: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  gateBody: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    maxWidth: 320,
  },
  gateButton: {
    alignSelf: 'stretch',
    borderRadius: 14,
    marginTop: 8,
  },
  gateButtonContent: {
    height: 50,
  },
});
