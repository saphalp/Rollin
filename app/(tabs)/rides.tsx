import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet } from 'react-native';
import type { Region } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RideActionCards } from '@/components/rides/ride-action-cards';
import { RideEmptyState } from '@/components/rides/ride-empty-state';
import { RideHeader } from '@/components/rides/ride-header';
import { RideMapCard } from '@/components/rides/ride-map-card';
import { RideTab, RideTabBar } from '@/components/rides/ride-tab-bar';
import { AppView } from '@/components/view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function RidesScreen() {
  const theme = useColorScheme() ?? 'light';
  const colors = Colors[theme];
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState<RideTab>('discover');
  const [region, setRegion] = useState<Region | null>(null);
  const [loadingLocation, setLoadingLocation] = useState(true);
  const [locationError, setLocationError] = useState<string | null>(null);

  useEffect(() => {
    loadCurrentLocation();
  }, []);

  async function loadCurrentLocation() {
    setLoadingLocation(true);
    setLocationError(null);

    try {
      const permission = await Location.requestForegroundPermissionsAsync();

      if (permission.status !== 'granted') {
        setLocationError('Location permission is required to show the map.');
        return;
      }

      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      setRegion({
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
        latitudeDelta: 0.04,
        longitudeDelta: 0.04,
      });
    } catch (error) {
      setLocationError(
        error instanceof Error ? error.message : 'Unable to load your current location.',
      );
    } finally {
      setLoadingLocation(false);
    }
  }

  function handleOfferRide() {
    router.push('/ride/offer');
  }

  function handleFindRide() {
    router.push('/ride/find');
  }

  function handleOpenFullMap() {
    router.push('/ride/map');
  }

  function showHowItWorks() {
    Alert.alert(
      'How ride sharing works',
      [
        'Offer a ride for any trip or connect it to a public activity.',
        'Find a ride by pickup, destination, date, time, or activity.',
        'Passengers request a seat.',
        'Drivers accept or decline requests.',
      ].join('\n\n'),
    );
  }

  return (
    <AppView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 110 }]}
      >
        <RideHeader onHelpPress={showHowItWorks} />

        <RideTabBar activeTab={activeTab} onTabChange={setActiveTab} />

        {activeTab === 'discover' && (
          <>
            <RideMapCard
              region={region}
              loadingLocation={loadingLocation}
              locationError={locationError}
              onRetry={loadCurrentLocation}
              onExpand={handleOpenFullMap}
            />

            <RideActionCards onFindRide={handleFindRide} onOfferRide={handleOfferRide} />
          </>
        )}

        {activeTab === 'offering' && (
          <RideEmptyState
            icon="car-outline"
            title="No active ride offers"
            message="Rides you are offering will appear here."
          />
        )}

        {activeTab === 'requests' && (
          <RideEmptyState
            icon="account-arrow-right-outline"
            title="No ride requests"
            message="Your pending and accepted requests will appear here."
          />
        )}

        {activeTab === 'history' && (
          <RideEmptyState
            icon="history"
            title="No ride history"
            message="Completed and cancelled rides will appear here."
          />
        )}
      </ScrollView>
    </AppView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    gap: 16,
  },
});
