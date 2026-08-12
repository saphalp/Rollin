import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import type { Region } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AttendingActivityPickerSheet } from '@/components/rides/attending-activity-picker-sheet';
import { RideActionCards } from '@/components/rides/ride-action-cards';
import {
  MyRideRequestDashboardCard,
  OfferedRideDashboardCard,
  RideHistoryDashboardCard,
} from '@/components/rides/ride-dashboard-cards';
import { RideEmptyState } from '@/components/rides/ride-empty-state';
import { RideHeader } from '@/components/rides/ride-header';
import { RideMapCard } from '@/components/rides/ride-map-card';
import { RideTab, RideTabBar } from '@/components/rides/ride-tab-bar';
import { AppText } from '@/components/text';
import { AppView } from '@/components/view';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useRideDashboardData } from '@/hooks/use-ride-dashboard-data';

type RideIntent = 'find' | 'offer';

type HistoryFilter = 'all' | 'offered' | 'requested';

const PICKER_COPY: Record<
  RideIntent,
  {
    title: string;
    subtitle: string;
  }
> = {
  offer: {
    title: 'Offer a ride for...',
    subtitle:
      'Pick an activity you\'re attending to connect this ride to, or continue without one.',
  },
  find: {
    title: 'Find a ride for...',
    subtitle:
      'Pick an activity you\'re attending to search rides for, or continue without one.',
  },
};

export default function RidesScreen() {
  const theme = useColorScheme() ?? 'light';
  const colors = Colors[theme];
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] =
    useState<RideTab>('discover');

  const [region, setRegion] =
    useState<Region | null>(null);

  const [loadingLocation, setLoadingLocation] =
    useState(true);

  const [locationError, setLocationError] =
    useState<string | null>(null);

  const [rideIntent, setRideIntent] =
    useState<RideIntent | null>(null);

  const [historyFilter, setHistoryFilter] =
    useState<HistoryFilter>('all');

  const [refreshing, setRefreshing] =
    useState(false);

  const {
    offeredRides,
    myRequests,
    history,
    dataLoading,
    dataError,
    loadRideData,
  } = useRideDashboardData(historyFilter);

  useEffect(() => {
    void loadCurrentLocation();
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
        latitude:
          currentLocation.coords.latitude,
        longitude:
          currentLocation.coords.longitude,
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

  async function handleRefresh() {
    setRefreshing(true);

    try {
      await Promise.all([
        loadCurrentLocation(),
        loadRideData(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }

  function handleOfferRide() {
    setRideIntent('offer');
  }

  function handleFindRide() {
    setRideIntent('find');
  }

  function closeRidePicker() {
    setRideIntent(null);
  }

  function goToRideScreen(
    intent: RideIntent,
    activityId?: string,
  ) {
    setRideIntent(null);

    if (intent === 'offer') {
      router.push(
        activityId
          ? {
            pathname: '/ride/offer',
            params: {
              activityId,
            },
          }
          : '/ride/offer',
      );

      return;
    }

    /*
     * Find Ride flow:
     *
     * If an activity is selected, go directly
     * to available rides for that activity.
     *
     * If no activity is selected, show regular rides.
     */
    router.push(
      activityId
        ? {
          pathname: '/ride/available',
          params: {
            activityId,
            rideType: 'activity',
          },
        }
        : {
          pathname: '/ride/available',
          params: {
            rideType: 'regular',
          },
        },
    );
  }

  function handleOpenFullMap() {
    router.push('/ride/map');
  }

  function openRideDetails(rideId: string) {
    router.push({
      pathname: '/ride/[id]',
      params: {
        id: rideId,
      },
    });
  }

  function showHowItWorks() {
    Alert.alert(
      'How ride sharing works',
      [
        'Offer a ride when you are already traveling somewhere and have extra seats.',
        'Find rides posted by other Rollin users.',
        'Passengers request a seat.',
        'The person offering the ride accepts or declines requests.',
        'Accepted passengers can use live location when the trip begins.',
      ].join('\n\n'),
    );
  }

  function renderLoading(
    message: string,
  ) {
    return (
      <View style={styles.loadingState}>
        <ActivityIndicator
          size="large"
          color={colors.tint}
        />

        <AppText
          style={[
            styles.loadingText,
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

  function renderOfferingTab() {
    if (dataLoading) {
      return renderLoading(
        'Loading your ride offers',
      );
    }

    if (dataError) {
      return (
        <RideEmptyState
          icon="alert-circle-outline"
          title="Unable to load ride offers"
          message={dataError}
        />
      );
    }

    if (offeredRides.length === 0) {
      return (
        <RideEmptyState
          icon="car-outline"
          title="No active ride offers"
          message="Rides you offer will appear here."
        />
      );
    }

    return (
      <View style={styles.list}>
        {offeredRides.map((ride) => (
          <OfferedRideDashboardCard
            key={ride.id}
            ride={ride}
            onPress={() =>
              openRideDetails(ride.id)
            }
          />
        ))}
      </View>
    );
  }

  function renderRequestsTab() {
    if (dataLoading) {
      return renderLoading(
        'Loading your ride requests',
      );
    }

    if (dataError) {
      return (
        <RideEmptyState
          icon="alert-circle-outline"
          title="Unable to load requests"
          message={dataError}
        />
      );
    }

    if (myRequests.length === 0) {
      return (
        <RideEmptyState
          icon="account-arrow-right-outline"
          title="No ride requests"
          message="Your pending and accepted ride requests will appear here."
        />
      );
    }

    return (
      <View style={styles.list}>
        {myRequests.map((request) => (
          <MyRideRequestDashboardCard
            key={request.id}
            request={request}
            onPress={() =>
              openRideDetails(
                request.rideId,
              )
            }
          />
        ))}
      </View>
    );
  }

  function renderHistoryTab() {
    if (dataLoading) {
      return renderLoading(
        'Loading ride history',
      );
    }

    if (dataError) {
      return (
        <RideEmptyState
          icon="alert-circle-outline"
          title="Unable to load history"
          message={dataError}
        />
      );
    }

    return (
      <>
        <View
          style={[
            styles.historyFilterBar,
            {
              backgroundColor:
                colors.surfaceContainer,
              borderColor:
                colors.outlineVariant,
            },
          ]}
        >
          {(
            [
              ['all', 'All'],
              ['offered', 'Offered'],
              ['requested', 'Requested'],
            ] as const
          ).map(([key, label]) => {
            const selected =
              historyFilter === key;

            return (
              <TouchableOpacity
                key={key}
                accessibilityRole="button"
                onPress={() =>
                  setHistoryFilter(key)
                }
                style={[
                  styles.historyFilterButton,
                  selected && {
                    backgroundColor:
                      colors.cardBackground,
                  },
                ]}
              >
                <AppText
                  style={[
                    styles.historyFilterText,
                    {
                      color: selected
                        ? colors.tint
                        : colors.icon,
                      fontFamily: Fonts?.sans,
                    },
                  ]}
                >
                  {label}
                </AppText>
              </TouchableOpacity>
            );
          })}
        </View>

        {history.length === 0 ? (
          <RideEmptyState
            icon="history"
            title="No ride history"
            message="Completed, cancelled, and rejected rides will appear here."
          />
        ) : (
          <View style={styles.list}>
            {history.map((item) => (
              <RideHistoryDashboardCard
                key={item.id}
                item={item}
              />
            ))}
          </View>
        )}
      </>
    );
  }

  return (
    <AppView
      style={[
        styles.container,
        {
          backgroundColor:
            colors.background,
        },
      ]}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.tint}
          />
        }
        contentContainerStyle={[
          styles.content,
          {
            paddingBottom:
              insets.bottom + 110,
          },
        ]}
      >
        <RideHeader
          onHelpPress={showHowItWorks}
        />

        <RideTabBar
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />

        {activeTab === 'discover' && (
          <>
            <RideMapCard
              region={region}
              loadingLocation={
                loadingLocation
              }
              locationError={
                locationError
              }
              onRetry={
                loadCurrentLocation
              }
              onExpand={
                handleOpenFullMap
              }
            />

            <RideActionCards
              onFindRide={
                handleFindRide
              }
              onOfferRide={
                handleOfferRide
              }
            />
          </>
        )}

        {activeTab === 'offering' &&
          renderOfferingTab()}

        {activeTab === 'requests' &&
          renderRequestsTab()}

        {activeTab === 'history' &&
          renderHistoryTab()}
      </ScrollView>

      {rideIntent && (
        <AttendingActivityPickerSheet
          visible
          title={
            PICKER_COPY[rideIntent]
              .title
          }
          subtitle={
            PICKER_COPY[rideIntent]
              .subtitle
          }
          onClose={
            closeRidePicker
          }
          onSelectActivity={(
            activityId,
          ) =>
            goToRideScreen(
              rideIntent,
              activityId,
            )
          }
          onSkip={() =>
            goToRideScreen(
              rideIntent,
            )
          }
        />
      )}
    </AppView>
  );
}

const styles =
  StyleSheet.create({
    container: {
      flex: 1,
    },

    content: {
      gap: 16,
    },

    list: {
      paddingHorizontal: 16,
      gap: 12,
    },

    loadingState: {
      minHeight: 280,
      alignItems: 'center',
      justifyContent: 'center',
    },

    loadingText: {
      marginTop: 10,
      fontSize: 13,
    },

    historyFilterBar: {
      flexDirection: 'row',
      borderWidth: 1,
      borderRadius: 16,
      marginHorizontal: 16,
      padding: 4,
    },

    historyFilterButton: {
      flex: 1,
      minHeight: 42,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 12,
    },

    historyFilterText: {
      fontSize: 13,
      fontWeight: '800',
    },
  });