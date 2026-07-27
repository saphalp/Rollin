import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import type {
  Region,
} from 'react-native-maps';
import MapView, {
  Marker,
} from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/text';
import { AppView } from '@/components/view';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type RideTab = 'discover' | 'offering' | 'requests' | 'history';

const RIDE_TABS: {
  key: RideTab;
  label: string;
  icon:
  | 'map-search-outline'
  | 'car-outline'
  | 'account-arrow-right-outline'
  | 'history';
}[] = [
    {
      key: 'discover',
      label: 'Discover',
      icon: 'map-search-outline',
    },
    {
      key: 'offering',
      label: 'Offering',
      icon: 'car-outline',
    },
    {
      key: 'requests',
      label: 'Requests',
      icon: 'account-arrow-right-outline',
    },
    {
      key: 'history',
      label: 'History',
      icon: 'history',
    },
  ];

export default function RidesScreen() {
  const theme = useColorScheme() ?? 'light';
  const colors = Colors[theme];
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] =
    useState<RideTab>('discover');
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
        latitudeDelta: 0.04,
        longitudeDelta: 0.04,
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
    router.push('/ride/offer');
  }

  function handleFindRide() {
    router.push('/ride/find');
  }

  function showHowItWorks() {
    Alert.alert(
      'How ride sharing works',
      [
        'Offer a ride for any trip or link it to a public activity.',
        'Find a ride by pickup, destination, date, time, or activity.',
        'Passengers request a seat.',
        'Drivers accept or decline requests.',
      ].join('\n\n'),
    );
  }

  function renderTabs() {
    return (
      <View
        style={[
          styles.tabBar,
          {
            backgroundColor: colors.surfaceContainer,
            borderColor: colors.outlineVariant,
          },
        ]}
      >
        {RIDE_TABS.map((tab) => {
          const selected = activeTab === tab.key;

          return (
            <TouchableOpacity
              key={tab.key}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onPress={() => setActiveTab(tab.key)}
              style={[
                styles.tabButton,
                selected && {
                  backgroundColor: colors.cardBackground,
                },
              ]}
            >
              <MaterialCommunityIcons
                name={tab.icon}
                size={19}
                color={
                  selected ? colors.tint : colors.tabIconDefault
                }
              />

              <AppText
                style={[
                  styles.tabLabel,
                  {
                    color: selected
                      ? colors.tint
                      : colors.tabIconDefault,
                    fontFamily: Fonts?.sans,
                  },
                ]}
              >
                {tab.label}
              </AppText>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  }

  function renderDiscover() {
    return (
      <>
        <View
          style={[
            styles.mapCard,
            {
              backgroundColor: colors.cardBackground,
              borderColor: colors.outlineVariant,
            },
          ]}
        >
          <View style={styles.mapHeader}>
            <View style={styles.mapHeaderText}>
              <AppText
                style={[
                  styles.sectionTitle,
                  {
                    color: colors.text,
                    fontFamily: Fonts?.sans,
                  },
                ]}
              >
                Nearby rides and activities
              </AppText>

              <AppText
                style={[
                  styles.sectionSubtitle,
                  {
                    color: colors.icon,
                    fontFamily: Fonts?.sans,
                  },
                ]}
              >
                Public activity locations will appear here.
              </AppText>
            </View>

            <MaterialCommunityIcons
              name="map-marker-radius-outline"
              size={24}
              color={colors.tint}
            />
          </View>

          <View style={styles.mapContainer}>
            {loadingLocation && (
              <View
                style={[
                  styles.mapStatus,
                  {
                    backgroundColor:
                      colors.surfaceContainerHigh,
                  },
                ]}
              >
                <ActivityIndicator
                  size="large"
                  color={colors.tint}
                />

                <AppText
                  style={[
                    styles.mapStatusText,
                    {
                      color: colors.icon,
                      fontFamily: Fonts?.sans,
                    },
                  ]}
                >
                  Loading your location
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
                  description="Current area"
                  pinColor={colors.tint}
                />
              </MapView>
            )}

            {!loadingLocation && !region && (
              <View
                style={[
                  styles.mapStatus,
                  {
                    backgroundColor:
                      colors.surfaceContainerHigh,
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name="map-marker-off-outline"
                  size={34}
                  color={colors.icon}
                />

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
                      color: colors.icon,
                      fontFamily: Fonts?.sans,
                    },
                  ]}
                >
                  {locationError ??
                    'Your current location could not be loaded.'}
                </AppText>

                <TouchableOpacity
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
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={handleFindRide}
            style={[
              styles.actionCard,
              {
                backgroundColor: colors.tint,
                borderColor: colors.tint,
              },
            ]}
          >
            <View
              style={[
                styles.actionIcon,
                {
                  backgroundColor: colors.onPrimary,
                },
              ]}
            >
              <MaterialCommunityIcons
                name="car-search-outline"
                size={25}
                color={colors.tint}
              />
            </View>

            <AppText
              style={[
                styles.actionTitle,
                {
                  color: colors.onPrimary,
                  fontFamily: Fonts?.sans,
                },
              ]}
            >
              Find a Ride
            </AppText>

            <AppText
              style={[
                styles.actionText,
                {
                  color: colors.onPrimary,
                  fontFamily: Fonts?.sans,
                },
              ]}
            >
              Search by route, date, time, or activity.
            </AppText>
          </TouchableOpacity>

          <TouchableOpacity
            accessibilityRole="button"
            onPress={handleOfferRide}
            style={[
              styles.actionCard,
              {
                backgroundColor: colors.cardBackground,
                borderColor: colors.outlineVariant,
              },
            ]}
          >
            <View
              style={[
                styles.actionIcon,
                {
                  backgroundColor: colors.primaryContainer,
                },
              ]}
            >
              <MaterialCommunityIcons
                name="car-plus"
                size={25}
                color={colors.onPrimary}
              />
            </View>

            <AppText
              style={[
                styles.actionTitle,
                {
                  color: colors.text,
                  fontFamily: Fonts?.sans,
                },
              ]}
            >
              Offer a Ride
            </AppText>

            <AppText
              style={[
                styles.actionText,
                {
                  color: colors.icon,
                  fontFamily: Fonts?.sans,
                },
              ]}
            >
              Share seats for any trip or a public activity.
            </AppText>
          </TouchableOpacity>
        </View>
      </>
    );
  }

  function renderEmptyState(
    icon:
      | 'car-outline'
      | 'account-arrow-right-outline'
      | 'history',
    title: string,
    message: string,
  ) {
    return (
      <View
        style={[
          styles.emptyState,
          {
            backgroundColor: colors.cardBackground,
            borderColor: colors.outlineVariant,
          },
        ]}
      >
        <View
          style={[
            styles.emptyIcon,
            {
              backgroundColor: colors.surfaceContainer,
            },
          ]}
        >
          <MaterialCommunityIcons
            name={icon}
            size={32}
            color={colors.tint}
          />
        </View>

        <AppText
          style={[
            styles.emptyTitle,
            {
              color: colors.text,
              fontFamily: Fonts?.sans,
            },
          ]}
        >
          {title}
        </AppText>

        <AppText
          style={[
            styles.emptyMessage,
            {
              color: colors.icon,
              fontFamily: Fonts?.sans,
            },
          ]}
        >
          {message}
        </AppText>
      </View>
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
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          {
            paddingBottom: insets.bottom + 110,
          },
        ]}
      >
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
                  color: colors.icon,
                  fontFamily: Fonts?.sans,
                },
              ]}
            >
              Find a trip, share seats, and manage your rides.
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
            <MaterialCommunityIcons
              name="help"
              size={22}
              color={colors.onPrimary}
            />
          </TouchableOpacity>
        </View>

        {renderTabs()}

        {activeTab === 'discover' && renderDiscover()}

        {activeTab === 'offering' &&
          renderEmptyState(
            'car-outline',
            'No active ride offers',
            'Rides you are offering will appear here.',
          )}

        {activeTab === 'requests' &&
          renderEmptyState(
            'account-arrow-right-outline',
            'No ride requests',
            'Your pending and accepted requests will appear here.',
          )}

        {activeTab === 'history' &&
          renderEmptyState(
            'history',
            'No ride history',
            'Completed and cancelled rides will appear here.',
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
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
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
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 16,
    padding: 4,
  },
  tabButton: {
    flex: 1,
    minHeight: 54,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingHorizontal: 2,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  mapCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 14,
    gap: 12,
  },
  mapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  mapHeaderText: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  sectionSubtitle: {
    marginTop: 2,
    fontSize: 13,
    lineHeight: 18,
  },
  mapContainer: {
    height: 265,
    overflow: 'hidden',
    borderRadius: 16,
  },
  mapStatus: {
    flex: 1,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapErrorTitle: {
    marginTop: 10,
    fontSize: 17,
    fontWeight: '700',
  },
  mapStatusText: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 14,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionCard: {
    flex: 1,
    minHeight: 160,
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTitle: {
    marginTop: 13,
    fontSize: 16,
    fontWeight: '800',
  },
  actionText: {
    marginTop: 5,
    fontSize: 12,
    lineHeight: 17,
  },
  emptyState: {
    minHeight: 320,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    marginTop: 18,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  emptyMessage: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
});