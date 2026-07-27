import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, {
  Marker,
  Region,
} from 'react-native-maps';

import { AppText } from '@/components/text';
import { AppView } from '@/components/view';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function RidesScreen() {
  const theme = useColorScheme() ?? 'light';
  const colors = Colors[theme];

  const [region, setRegion] = useState<Region | null>(null);
  const [loadingLocation, setLoadingLocation] = useState(true);
  const [locationError, setLocationError] =
    useState<string | null>(null);

  useEffect(() => {
    loadCurrentLocation();
  }, []);

  async function loadCurrentLocation() {
    setLoadingLocation(true);
    setLocationError(null);

    try {
      const permission =
        await Location.requestForegroundPermissionsAsync();

      if (permission.status !== 'granted') {
        setLocationError(
          'Location permission is required to show the map.',
        );
        return;
      }

      const currentLocation =
        await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

      setRegion({
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
        latitudeDelta: 0.025,
        longitudeDelta: 0.025,
      });
    } catch (error) {
      setLocationError(
        error instanceof Error
          ? error.message
          : 'Unable to load your current location.',
      );
    } finally {
      setLoadingLocation(false);
    }
  }

  function handleOfferRide() {
    router.push({
      pathname: '/(tabs)/explore',
      params: {
        rideAction: 'offer',
      },
    });
  }

  function handleFindRide() {
    router.push({
      pathname: '/(tabs)/explore',
      params: {
        rideAction: 'find',
      },
    });
  }

  function showHowItWorks() {
    Alert.alert(
      'How ride sharing works',
      [
        '1. Select a public activity.',
        '2. Offer available seats or find a driver.',
        '3. Passengers request to join a ride.',
        '4. The driver accepts or declines each request.',
      ].join('\n\n'),
    );
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
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <AppText
              style={[
                styles.title,
                {
                  color: colors.text,
                  fontFamily: Fonts?.sans,
                },
              ]}
            >
              Ride Sharing
            </AppText>

            <AppText
              style={[
                styles.subtitle,
                {
                  color: colors.outline,
                  fontFamily: Fonts?.sans,
                },
              ]}
            >
              Share your car or find a ride to a public activity.
            </AppText>
          </View>

          <TouchableOpacity
            accessibilityRole="button"
            onPress={showHowItWorks}
            style={[
              styles.helpButton,
              {
                backgroundColor: colors.primaryContainer,
              },
            ]}
          >
            <AppText
              style={[
                styles.helpButtonText,
                {
                  color: colors.tint,
                  fontFamily: Fonts?.sans,
                },
              ]}
            >
              ?
            </AppText>
          </TouchableOpacity>
        </View>

        <View
          style={[
            styles.mapCard,
            {
              backgroundColor: colors.cardBackground,
              borderColor: colors.outlineVariant,
            },
          ]}
        >
          {loadingLocation && (
            <View style={styles.mapStatus}>
              <ActivityIndicator
                size="large"
                color={colors.tint}
              />

              <AppText
                style={[
                  styles.mapStatusText,
                  {
                    color: colors.outline,
                    fontFamily: Fonts?.sans,
                  },
                ]}
              >
                Loading your location...
              </AppText>
            </View>
          )}

          {!loadingLocation && region && (
            <MapView
              style={StyleSheet.absoluteFill}
              initialRegion={region}
              showsUserLocation
              showsMyLocationButton
            >
              <Marker
                coordinate={{
                  latitude: region.latitude,
                  longitude: region.longitude,
                }}
                title="Your location"
                description="Your current pickup area"
                pinColor="#1261D8"
              />
            </MapView>
          )}

          {!loadingLocation && !region && (
            <View style={styles.mapStatus}>
              <AppText
                style={[
                  styles.mapErrorTitle,
                  {
                    color: colors.text,
                    fontFamily: Fonts?.sans,
                  },
                ]}
              >
                Map unavailable
              </AppText>

              <AppText
                style={[
                  styles.mapStatusText,
                  {
                    color: colors.outline,
                    fontFamily: Fonts?.sans,
                  },
                ]}
              >
                {locationError ??
                  'Your current location could not be loaded.'}
              </AppText>

              <TouchableOpacity
                accessibilityRole="button"
                onPress={loadCurrentLocation}
                style={[
                  styles.retryButton,
                  {
                    borderColor: colors.tint,
                  },
                ]}
              >
                <AppText
                  style={[
                    styles.retryButtonText,
                    {
                      color: colors.tint,
                      fontFamily: Fonts?.sans,
                    },
                  ]}
                >
                  Try Again
                </AppText>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View
          style={[
            styles.informationCard,
            {
              backgroundColor: colors.cardBackground,
              borderColor: colors.outlineVariant,
            },
          ]}
        >
          <AppText
            style={[
              styles.informationTitle,
              {
                color: colors.text,
                fontFamily: Fonts?.sans,
              },
            ]}
          >
            Where are you going?
          </AppText>

          <AppText
            style={[
              styles.informationText,
              {
                color: colors.outline,
                fontFamily: Fonts?.sans,
              },
            ]}
          >
            Select a public activity first. You can then offer
            available seats or request to ride with another
            attendee.
          </AppText>
        </View>

        <TouchableOpacity
          accessibilityRole="button"
          onPress={handleOfferRide}
          style={[
            styles.primaryButton,
            {
              backgroundColor: colors.tint,
            },
          ]}
        >
          <View style={styles.buttonIcon}>
            <AppText style={styles.buttonEmoji}>🚗</AppText>
          </View>

          <View style={styles.buttonTextContainer}>
            <AppText
              style={[
                styles.primaryButtonTitle,
                {
                  color: colors.onImageOverlay,
                  fontFamily: Fonts?.sans,
                },
              ]}
            >
              Offer a Ride
            </AppText>

            <AppText
              style={[
                styles.primaryButtonSubtitle,
                {
                  color: colors.onImageOverlay,
                  fontFamily: Fonts?.sans,
                },
              ]}
            >
              Select an activity and share your available seats
            </AppText>
          </View>

          <AppText
            style={[
              styles.arrow,
              {
                color: colors.onImageOverlay,
                fontFamily: Fonts?.sans,
              },
            ]}
          >
            ›
          </AppText>
        </TouchableOpacity>

        <TouchableOpacity
          accessibilityRole="button"
          onPress={handleFindRide}
          style={[
            styles.secondaryButton,
            {
              backgroundColor: colors.cardBackground,
              borderColor: colors.tint,
            },
          ]}
        >
          <View
            style={[
              styles.buttonIcon,
              {
                backgroundColor: colors.primaryContainer,
              },
            ]}
          >
            <AppText style={styles.buttonEmoji}>📍</AppText>
          </View>

          <View style={styles.buttonTextContainer}>
            <AppText
              style={[
                styles.secondaryButtonTitle,
                {
                  color: colors.text,
                  fontFamily: Fonts?.sans,
                },
              ]}
            >
              Find a Ride
            </AppText>

            <AppText
              style={[
                styles.secondaryButtonSubtitle,
                {
                  color: colors.outline,
                  fontFamily: Fonts?.sans,
                },
              ]}
            >
              View drivers going to the same activity
            </AppText>
          </View>

          <AppText
            style={[
              styles.arrow,
              {
                color: colors.tint,
                fontFamily: Fonts?.sans,
              },
            ]}
          >
            ›
          </AppText>
        </TouchableOpacity>
      </View>
    </AppView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
  },
  subtitle: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 20,
  },
  helpButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  helpButtonText: {
    fontSize: 20,
    fontWeight: '800',
  },
  mapCard: {
    height: 260,
    overflow: 'hidden',
    borderWidth: 1,
    borderRadius: 18,
  },
  mapStatus: {
    flex: 1,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapErrorTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  mapStatusText: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  informationCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 15,
  },
  informationTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  informationText: {
    marginTop: 5,
    fontSize: 13,
    lineHeight: 19,
  },
  primaryButton: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  secondaryButton: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  buttonIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonEmoji: {
    fontSize: 22,
  },
  buttonTextContainer: {
    flex: 1,
  },
  primaryButtonTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  primaryButtonSubtitle: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 17,
    opacity: 0.9,
  },
  secondaryButtonTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  secondaryButtonSubtitle: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 17,
  },
  arrow: {
    fontSize: 28,
    fontWeight: '400',
  },
});