import { useGuidedTour } from '@/components/tutorial/guided-tour-provider';
import { TourTarget, TourScrollView } from '@/components/tutorial/tour-target';
import * as Location from 'expo-location';
import { router, useIsFocused } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
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
  OthersRideOfferDashboardCard,
  OthersRideRequestDashboardCard,
  OthersRideRequestItem,
  RideHistoryDashboardCard,
} from '@/components/rides/ride-dashboard-cards';
import { RideEmptyState } from '@/components/rides/ride-empty-state';
import { RideHeader } from '@/components/rides/ride-header';
import { RideHowItWorksSheet } from '@/components/rides/ride-how-it-works-sheet';
import { RideMapCard } from '@/components/rides/ride-map-card';
import { RideSegmentedControl } from '@/components/rides/ride-segmented-control';
import { RideTab, RideTabBar } from '@/components/rides/ride-tab-bar';
import { AppText } from '@/components/text';
import { AppView } from '@/components/view';
import { Colors, Fonts } from '@/constants/theme';
import { useAuthContext } from '@/hooks/use-auth-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useRideDashboardData } from '@/hooks/use-ride-dashboard-data';
import { useRideWantedRequests } from '@/hooks/use-ride-wanted-requests';
import { MyRideRequestDashboardItem } from '@/services/ride-dashboard-service';
import { cancelWantedRequest } from '@/services/ride-wanted-requests-service';

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
      'Pick an activity you\'re attending or hosting to connect this ride to, or continue without one.',
  },
  find: {
    title: 'Find a ride for...',
    subtitle:
      'Pick an activity you\'re attending or hosting to search rides for, or continue without one.',
  },
};

export default function RidesScreen() {
  const theme = useColorScheme() ?? 'light';
  const colors = Colors[theme];
  const insets = useSafeAreaInsets();

  const { active, overview, promptsBlocked } = useGuidedTour();
  const focused = useIsFocused();
  const [selectedTab, setActiveTab] =
    useState<RideTab>('discover');
  const activeTab = active && !overview ? 'discover' : selectedTab;

  const [region, setRegion] =
    useState<Region | null>(null);

  const [loadingLocation, setLoadingLocation] =
    useState(true);

  const [locationError, setLocationError] =
    useState<string | null>(null);

  const [howItWorksVisible, setHowItWorksVisible] =
    useState(false);

  const [rideIntent, setRideIntent] =
    useState<RideIntent | null>(null);

  const [historyFilter, setHistoryFilter] =
    useState<HistoryFilter>('all');

  const [offeringView, setOfferingView] =
    useState<'mine' | 'others'>('mine');

  const [requestsView, setRequestsView] =
    useState<'mine' | 'others'>('mine');

  const [refreshing, setRefreshing] =
    useState(false);

  const {
    offeredRides,
    othersOffers,
    myRequests,
    incomingSeatRequests,
    history,
    historyLoading,
    dataLoading,
    dataError,
    loadRideData,
  } = useRideDashboardData(historyFilter);

  const { claims } = useAuthContext();
  const {
    requests: wantedRequests,
    loading: wantedLoading,
    refresh: refreshWantedRequests,
  } = useRideWantedRequests({ filter: 'all' });
  // "Requested by others": seat requests on your rides plus other students' open ride
  // requests, soonest first.
  const othersRequests: OthersRideRequestItem[] = [
    ...incomingSeatRequests.map((request) => ({ kind: 'seat' as const, request })),
    ...wantedRequests
      .filter((request) => request.requesterId !== claims?.sub)
      .map((request) => ({ kind: 'wanted' as const, request })),
  ].sort((a, b) => {
    const aTime = a.request.dateTime ? new Date(a.request.dateTime).getTime() : Infinity;
    const bTime = b.request.dateTime ? new Date(b.request.dateTime).getTime() : Infinity;
    return aTime - bTime;
  });

  useEffect(() => {
    if (!promptsBlocked && focused) void loadCurrentLocation();
  }, [promptsBlocked, focused]);

  // The tab stays mounted while other screens are open, and realtime doesn't reliably
  // deliver ride_wanted_requests changes, so reload when coming back (e.g. after accepting
  // a request). The first focus is skipped because the hooks already load on mount.
  const hasBeenFocused = useRef(false);
  useEffect(() => {
    if (!focused) return;
    if (!hasBeenFocused.current) {
      hasBeenFocused.current = true;
      return;
    }
    void loadRideData();
    void refreshWantedRequests();
  }, [focused, loadRideData, refreshWantedRequests]);

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
        refreshWantedRequests(),
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

  function handleRequestCardPress(request: MyRideRequestDashboardItem) {
    if (request.kind === 'seat') {
      openRideDetails(request.rideId);
      return;
    }

    Alert.alert(
      'Cancel this request?',
      'Drivers will no longer see this ride request.',
      [
        { text: 'Keep Request', style: 'cancel' },
        {
          text: 'Cancel Request',
          style: 'destructive',
          onPress: async () => {
            try {
              await cancelWantedRequest(request.wantedRequestId);
              await loadRideData();
            } catch (error) {
              Alert.alert(
                'Could not cancel request',
                error instanceof Error ? error.message : 'Something went wrong.',
              );
            }
          },
        },
      ],
    );
  }

  function openRideDetails(rideId: string) {
    router.push({
      pathname: '/ride/[id]',
      params: {
        id: rideId,
      },
    });
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

  function renderSectionState(options: {
    loading: boolean;
    loadingMessage: string;
    errorTitle: string;
    isEmpty: boolean;
    emptyIcon: Parameters<typeof RideEmptyState>[0]['icon'];
    emptyTitle: string;
    emptyMessage: string;
  }) {
    if (options.loading) return renderLoading(options.loadingMessage);

    if (dataError) {
      return (
        <RideEmptyState
          icon="alert-circle-outline"
          title={options.errorTitle}
          message={dataError}
        />
      );
    }

    if (options.isEmpty) {
      return (
        <RideEmptyState
          icon={options.emptyIcon}
          title={options.emptyTitle}
          message={options.emptyMessage}
        />
      );
    }

    return null;
  }

  function renderOfferingTab() {
    const showingMine = offeringView === 'mine';
    const state = renderSectionState(showingMine
      ? {
        loading: dataLoading,
        loadingMessage: 'Loading your ride offers',
        errorTitle: 'Unable to load ride offers',
        isEmpty: offeredRides.length === 0,
        emptyIcon: 'car-outline',
        emptyTitle: 'No active ride offers',
        emptyMessage: 'Rides you offer will appear here.',
      }
      : {
        loading: dataLoading,
        loadingMessage: 'Loading rides',
        errorTitle: 'Unable to load rides',
        isEmpty: othersOffers.length === 0,
        emptyIcon: 'car-off',
        emptyTitle: 'No rides offered right now',
        emptyMessage: 'Open rides other students offer will appear here.',
      });

    return (
      <>
        <RideSegmentedControl
          options={[
            { key: 'mine', label: 'Offered by you', count: offeredRides.length },
            { key: 'others', label: 'Offered by others', count: othersOffers.length },
          ]}
          value={offeringView}
          onChange={setOfferingView}
        />

        {state ?? (
          <View style={styles.list}>
            {showingMine
              ? offeredRides.map((ride) => (
                <OfferedRideDashboardCard
                  key={ride.id}
                  ride={ride}
                  onPress={() => openRideDetails(ride.id)}
                />
              ))
              : othersOffers.map((ride) => (
                <OthersRideOfferDashboardCard
                  key={ride.id}
                  ride={ride}
                  onPress={() => openRideDetails(ride.id)}
                />
              ))}
          </View>
        )}
      </>
    );
  }

  function handleOthersRequestPress(item: OthersRideRequestItem) {
    if (item.kind === 'seat') {
      // Accept or decline it on the ride's page.
      openRideDetails(item.request.rideId);
      return;
    }

    const request = item.request;
    const when = request.dateTime
      ? `\n${new Date(request.dateTime).toLocaleString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })}`
      : '';

    Alert.alert(
      `Offer ${request.requester.name} a ride?`,
      `${request.pickupLocation} → ${request.destination}${when}\n\nYou'll choose your seats and add notes before confirming.`,
      [
        { text: 'Not now', style: 'cancel' },
        {
          text: 'Offer ride',
          onPress: () =>
            router.push({
              pathname: '/ride/offer',
              params: { sourceRequestId: request.id },
            }),
        },
      ],
    );
  }

  function renderRequestsTab() {
    const showingMine = requestsView === 'mine';
    const state = renderSectionState(showingMine
      ? {
        loading: dataLoading,
        loadingMessage: 'Loading your ride requests',
        errorTitle: 'Unable to load requests',
        isEmpty: myRequests.length === 0,
        emptyIcon: 'account-arrow-right-outline',
        emptyTitle: 'No ride requests',
        emptyMessage: 'Your pending and accepted ride requests will appear here.',
      }
      : {
        loading: dataLoading || wantedLoading,
        loadingMessage: 'Loading requests',
        errorTitle: 'Unable to load requests',
        isEmpty: othersRequests.length === 0,
        emptyIcon: 'account-search-outline',
        emptyTitle: 'No requests from others',
        emptyMessage: 'Seat requests for your rides and students looking for a ride will appear here.',
      });

    return (
      <>
        <RideSegmentedControl
          options={[
            { key: 'mine', label: 'Requested by you', count: myRequests.length },
            { key: 'others', label: 'Requested by others', count: othersRequests.length },
          ]}
          value={requestsView}
          onChange={setRequestsView}
        />

        {state ?? (
          <View style={styles.list}>
            {showingMine
              ? myRequests.map((request) => (
                <MyRideRequestDashboardCard
                  key={request.id}
                  request={request}
                  onPress={() => handleRequestCardPress(request)}
                />
              ))
              : othersRequests.map((item) => (
                <OthersRideRequestDashboardCard
                  key={`${item.kind}-${item.request.id}`}
                  item={item}
                  onPress={() => handleOthersRequestPress(item)}
                />
              ))}
          </View>
        )}
      </>
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

        {historyLoading ? (
          renderLoading('Loading ride history')
        ) : history.length === 0 ? (
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
                onPress={() => item.rideId
                  ? openRideDetails(item.rideId)
                  : Alert.alert('Ride request', item.pickupLocation + ' → ' + item.destination + '\nStatus: ' + item.status)}
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
      <TourScrollView
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
          onHelpPress={() => setHowItWorksVisible(true)}
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

            <TourTarget id="ride-actions"><RideActionCards
              onFindRide={
                handleFindRide
              }
              onOfferRide={
                handleOfferRide
              }
            /></TourTarget>
          </>
        )}

        {activeTab === 'offering' &&
          renderOfferingTab()}

        {activeTab === 'requests' &&
          renderRequestsTab()}

        {activeTab === 'history' &&
          renderHistoryTab()}
      </TourScrollView>

      <RideHowItWorksSheet
        visible={howItWorksVisible}
        onClose={() => setHowItWorksVisible(false)}
      />

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
      borderRadius: 14,
      padding: 4,
    },

    historyFilterButton: {
      flex: 1,
      minHeight: 42,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 10,
    },

    historyFilterText: {
      fontSize: 14,
      fontWeight: '700',
    },
  });