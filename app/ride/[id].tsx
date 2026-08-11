import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import {
    useCallback,
    useEffect,
    useState,
} from 'react';
import {
    ActivityIndicator,
    Alert,
    RefreshControl,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RideDetailCard } from '@/components/rides/ride-detail-card';
import { RideRequestButton } from '@/components/rides/ride-request-button';
import { AppText } from '@/components/text';
import { AppView } from '@/components/view';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useRideRequest } from '@/hooks/use-ride-request';
import { openRideTracking } from '@/navigation/ride-navigation';

import {
    acceptPassengerRequest,
    declinePassengerRequest,
    fetchRidePassengerRequests,
    isCurrentUserRideOfferer,
    OffererPassengerRequest,
    subscribeToRidePassengerRequests,
} from '@/services/offerer-ride-requests-service';

import { fetchRideById } from '@/services/rides-service';
import { RideOffer } from '@/types/rides';

export default function RideDetailsScreen() {
    const params =
        useLocalSearchParams<{ id?: string }>();

    const rideId =
        typeof params.id === 'string'
            ? params.id
            : '';

    const theme =
        useColorScheme() ?? 'light';

    const colors = Colors[theme];

    const insets =
        useSafeAreaInsets();

    /*
     * Main ride state
     */
    const [ride, setRide] =
        useState<RideOffer | null>(null);

    const [loadingRide, setLoadingRide] =
        useState(true);

    const [rideError, setRideError] =
        useState<string | null>(null);

    /*
     * Determines whether the current user
     * is the person offering this ride.
     */
    const [isOfferer, setIsOfferer] =
        useState(false);

    /*
     * Requests visible to the ride offerer.
     */
    const [
        passengerRequests,
        setPassengerRequests,
    ] = useState<
        OffererPassengerRequest[]
    >([]);

    const [
        loadingPassengerRequests,
        setLoadingPassengerRequests,
    ] = useState(false);

    const [
        passengerRequestError,
        setPassengerRequestError,
    ] = useState<string | null>(
        null,
    );

    /*
     * Used when accepting or declining.
     */
    const [
        managingRequestId,
        setManagingRequestId,
    ] = useState<string | null>(
        null,
    );

    const [refreshing, setRefreshing] =
        useState(false);

    /*
     * Passenger-side ride request hook.
     *
     * We keep this because passengers still
     * need Request Seat / Cancel Request.
     */
    const {
        request,
        loading: loadingRequest,
        submitting,
        errorMessage: requestError,
        requestSeat,
        cancelSeatRequest,
    } = useRideRequest(
        isOfferer ? null : ride,
    );

    /*
     * Load the ride itself.
     */
    const loadRide =
        useCallback(async () => {
            if (!rideId) {
                setRideError(
                    'Ride ID is missing.',
                );

                setLoadingRide(false);
                return;
            }

            setRideError(null);

            try {
                const loadedRide =
                    await fetchRideById(
                        rideId,
                    );

                if (!loadedRide) {
                    throw new Error(
                        'This ride could not be found.',
                    );
                }

                setRide(loadedRide);

                /*
                 * Check whether the current user
                 * owns this ride.
                 */
                const ownsRide =
                    await isCurrentUserRideOfferer(
                        loadedRide.driverId,
                    );

                setIsOfferer(ownsRide);
            } catch (error) {
                setRideError(
                    error instanceof Error
                        ? error.message
                        : 'Could not load this ride.',
                );
            } finally {
                setLoadingRide(false);
            }
        }, [rideId]);

    /*
     * Load requests for the person offering
     * this ride.
     */
    const loadPassengerRequests =
        useCallback(async () => {
            if (!rideId || !isOfferer) {
                return;
            }

            setPassengerRequestError(
                null,
            );

            setLoadingPassengerRequests(
                true,
            );

            try {
                const requests =
                    await fetchRidePassengerRequests(
                        rideId,
                    );

                setPassengerRequests(
                    requests,
                );
            } catch (error) {
                setPassengerRequestError(
                    error instanceof Error
                        ? error.message
                        : 'Could not load passenger requests.',
                );
            } finally {
                setLoadingPassengerRequests(
                    false,
                );
            }
        }, [rideId, isOfferer]);

    /*
     * Initial ride load.
     */
    useEffect(() => {
        void loadRide();
    }, [loadRide]);

    /*
     * Once we know this user owns the ride,
     * load passenger requests.
     */
    useEffect(() => {
        if (!isOfferer) {
            setPassengerRequests([]);
            return;
        }

        void loadPassengerRequests();
    }, [
        isOfferer,
        loadPassengerRequests,
    ]);

    /*
     * Realtime updates.
     *
     * If someone requests/cancels a seat,
     * the offerer screen updates automatically.
     */
    useEffect(() => {
        if (
            !rideId ||
            !isOfferer
        ) {
            return;
        }

        const unsubscribe =
            subscribeToRidePassengerRequests(
                rideId,
                () => {
                    void loadPassengerRequests();
                    void loadRide();
                },
            );

        return unsubscribe;
    }, [
        rideId,
        isOfferer,
        loadPassengerRequests,
        loadRide,
    ]);

    function goBack() {
        if (router.canGoBack()) {
            router.back();
            return;
        }

        router.replace(
            '/(tabs)/rides',
        );
    }

    /*
     * PASSENGER
     * Request a seat.
     */
    async function handleRequest() {
        try {
            await requestSeat();

            Alert.alert(
                'Request sent',
                'The person offering this ride can now accept or decline your request.',
            );
        } catch {
            /*
             * useRideRequest already
             * exposes the actual error.
             */
        }
    }

    /*
     * PASSENGER
     * Cancel their existing request.
     */
    function handleCancel() {
        Alert.alert(
            'Cancel ride request?',
            'You will give up your request for this ride.',
            [
                {
                    text: 'Keep Request',
                    style: 'cancel',
                },
                {
                    text: 'Cancel Request',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await cancelSeatRequest();
                        } catch {
                            /*
                             * Hook displays error.
                             */
                        }
                    },
                },
            ],
        );
    }

    /*
     * OFFERER
     * Accept passenger.
     */
    function handleAccept(
        passengerRequest: OffererPassengerRequest,
    ) {
        if (!ride) {
            return;
        }

        if (ride.availableSeats < 1) {
            Alert.alert(
                'No seats remaining',
                'This ride is already full.',
            );

            return;
        }

        Alert.alert(
            'Accept passenger?',
            `Accept ${passengerRequest.requesterName} for this ride?`,
            [
                {
                    text: 'Cancel',
                    style: 'cancel',
                },
                {
                    text: 'Accept',
                    onPress: async () => {
                        setManagingRequestId(
                            passengerRequest.id,
                        );

                        try {
                            await acceptPassengerRequest(
                                passengerRequest.id,
                            );

                            /*
                             * Reload both because the RPC
                             * changes:
                             *
                             * ride_requests.status
                             * AND
                             * rides_offered.available_seats
                             */
                            await Promise.all([
                                loadPassengerRequests(),
                                loadRide(),
                            ]);

                            Alert.alert(
                                'Passenger accepted',
                                `${passengerRequest.requesterName} now has a seat on this ride.`,
                            );
                        } catch (error) {
                            Alert.alert(
                                'Could not accept passenger',
                                error instanceof Error
                                    ? error.message
                                    : 'Something went wrong.',
                            );
                        } finally {
                            setManagingRequestId(
                                null,
                            );
                        }
                    },
                },
            ],
        );
    }

    /*
     * OFFERER
     * Decline passenger.
     */
    function handleDecline(
        passengerRequest: OffererPassengerRequest,
    ) {
        Alert.alert(
            'Decline request?',
            `Decline ${passengerRequest.requesterName}'s ride request?`,
            [
                {
                    text: 'Cancel',
                    style: 'cancel',
                },
                {
                    text: 'Decline',
                    style: 'destructive',
                    onPress: async () => {
                        setManagingRequestId(
                            passengerRequest.id,
                        );

                        try {
                            await declinePassengerRequest(
                                passengerRequest.id,
                            );

                            await loadPassengerRequests();

                            Alert.alert(
                                'Request declined',
                                `${passengerRequest.requesterName}'s request was declined.`,
                            );
                        } catch (error) {
                            Alert.alert(
                                'Could not decline request',
                                error instanceof Error
                                    ? error.message
                                    : 'Something went wrong.',
                            );
                        } finally {
                            setManagingRequestId(
                                null,
                            );
                        }
                    },
                },
            ],
        );
    }

    async function handleRefresh() {
        setRefreshing(true);

        try {
            await loadRide();

            if (isOfferer) {
                await loadPassengerRequests();
            }
        } finally {
            setRefreshing(false);
        }
    }

    /*
     * Passenger gets tracking after their
     * request is accepted.
     *
     * Offerer gets tracking when trip starts.
     */
    const showTracking =
        isOfferer
            ? ride?.status ===
            'in_progress'
            : request?.status ===
            'accepted' ||
            ride?.status ===
            'in_progress';

    /*
     * Separate pending and accepted requests
     * for clearer offerer UI.
     */
    const pendingRequests =
        passengerRequests.filter(
            (item) =>
                item.status === 'pending',
        );

    const acceptedRequests =
        passengerRequests.filter(
            (item) =>
                item.status === 'accepted',
        );

    function renderPassengerRequest(
        passengerRequest: OffererPassengerRequest,
    ) {
        const managing =
            managingRequestId ===
            passengerRequest.id;

        const accepted =
            passengerRequest.status ===
            'accepted';

        return (
            <View
                key={passengerRequest.id}
                style={[
                    styles.passengerCard,
                    {
                        backgroundColor:
                            colors.cardBackground,
                        borderColor:
                            colors.outlineVariant,
                    },
                ]}
            >
                <View
                    style={
                        styles.passengerHeader
                    }
                >
                    <View
                        style={[
                            styles.avatar,
                            {
                                backgroundColor:
                                    accepted
                                        ? colors.secondaryContainer
                                        : colors.surfaceContainer,
                            },
                        ]}
                    >
                        <MaterialCommunityIcons
                            name="account"
                            size={25}
                            color={
                                accepted
                                    ? colors.onSecondaryContainer
                                    : colors.tint
                            }
                        />
                    </View>

                    <View
                        style={
                            styles.passengerInfo
                        }
                    >
                        <AppText
                            style={[
                                styles.passengerName,
                                {
                                    color: colors.text,
                                    fontFamily:
                                        Fonts?.sans,
                                },
                            ]}
                        >
                            {
                                passengerRequest.requesterName
                            }
                        </AppText>

                        <AppText
                            style={[
                                styles.passengerStatus,
                                {
                                    color: accepted
                                        ? colors.tint
                                        : colors.icon,
                                    fontFamily:
                                        Fonts?.sans,
                                },
                            ]}
                        >
                            {accepted
                                ? 'Accepted passenger'
                                : 'Waiting for your response'}
                        </AppText>
                    </View>

                    {accepted && (
                        <MaterialCommunityIcons
                            name="check-circle"
                            size={25}
                            color={colors.tint}
                        />
                    )}
                </View>

                {!accepted && (
                    <View
                        style={
                            styles.requestActions
                        }
                    >
                        <TouchableOpacity
                            accessibilityRole="button"
                            disabled={managing}
                            onPress={() =>
                                handleDecline(
                                    passengerRequest,
                                )
                            }
                            style={[
                                styles.declineButton,
                                {
                                    borderColor:
                                        colors.error,
                                },
                            ]}
                        >
                            {managing ? (
                                <ActivityIndicator
                                    size="small"
                                    color={colors.error}
                                />
                            ) : (
                                <>
                                    <MaterialCommunityIcons
                                        name="close"
                                        size={18}
                                        color={
                                            colors.error
                                        }
                                    />

                                    <AppText
                                        style={[
                                            styles.declineText,
                                            {
                                                color:
                                                    colors.error,
                                                fontFamily:
                                                    Fonts?.sans,
                                            },
                                        ]}
                                    >
                                        Decline
                                    </AppText>
                                </>
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity
                            accessibilityRole="button"
                            disabled={
                                managing ||
                                !ride ||
                                ride.availableSeats <
                                1 ||
                                ride.status !==
                                'open'
                            }
                            onPress={() =>
                                handleAccept(
                                    passengerRequest,
                                )
                            }
                            style={[
                                styles.acceptButton,
                                {
                                    backgroundColor:
                                        colors.tint,
                                },
                                (
                                    managing ||
                                    !ride ||
                                    ride.availableSeats <
                                    1 ||
                                    ride.status !==
                                    'open'
                                ) &&
                                styles.disabledButton,
                            ]}
                        >
                            {managing ? (
                                <ActivityIndicator
                                    size="small"
                                    color={
                                        colors.onPrimary
                                    }
                                />
                            ) : (
                                <>
                                    <MaterialCommunityIcons
                                        name="check"
                                        size={18}
                                        color={
                                            colors.onPrimary
                                        }
                                    />

                                    <AppText
                                        style={[
                                            styles.acceptText,
                                            {
                                                color:
                                                    colors.onPrimary,
                                                fontFamily:
                                                    Fonts?.sans,
                                            },
                                        ]}
                                    >
                                        Accept
                                    </AppText>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                )}
            </View>
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
            <View
                style={[
                    styles.header,
                    {
                        paddingTop:
                            insets.top + 10,
                        backgroundColor:
                            colors.cardBackground,
                        borderBottomColor:
                            colors.outlineVariant,
                    },
                ]}
            >
                <TouchableOpacity
                    accessibilityRole="button"
                    onPress={goBack}
                    style={[
                        styles.backButton,
                        {
                            backgroundColor:
                                colors.surfaceContainer,
                            borderColor:
                                colors.outlineVariant,
                        },
                    ]}
                >
                    <MaterialCommunityIcons
                        name="arrow-left"
                        size={24}
                        color={colors.text}
                    />
                </TouchableOpacity>

                <AppText
                    style={[
                        styles.headerTitle,
                        {
                            color: colors.text,
                            fontFamily:
                                Fonts?.sans,
                        },
                    ]}
                >
                    Ride Details
                </AppText>

                <View
                    style={
                        styles.headerSpacer
                    }
                />
            </View>

            {loadingRide ? (
                <View
                    style={
                        styles.centerState
                    }
                >
                    <ActivityIndicator
                        size="large"
                        color={colors.tint}
                    />
                </View>
            ) : rideError || !ride ? (
                <View
                    style={
                        styles.centerState
                    }
                >
                    <MaterialCommunityIcons
                        name="alert-circle-outline"
                        size={40}
                        color={colors.error}
                    />

                    <AppText
                        style={[
                            styles.errorText,
                            {
                                color: colors.text,
                                fontFamily:
                                    Fonts?.sans,
                            },
                        ]}
                    >
                        {rideError ??
                            'This ride could not be found.'}
                    </AppText>

                    <TouchableOpacity
                        onPress={loadRide}
                        style={[
                            styles.retryButton,
                            {
                                backgroundColor:
                                    colors.tint,
                            },
                        ]}
                    >
                        <AppText
                            style={[
                                styles.retryText,
                                {
                                    color:
                                        colors.onPrimary,
                                    fontFamily:
                                        Fonts?.sans,
                                },
                            ]}
                        >
                            Try Again
                        </AppText>
                    </TouchableOpacity>
                </View>
            ) : (
                <ScrollView
                    showsVerticalScrollIndicator={
                        false
                    }
                    refreshControl={
                        <RefreshControl
                            refreshing={
                                refreshing
                            }
                            onRefresh={
                                handleRefresh
                            }
                            tintColor={
                                colors.tint
                            }
                        />
                    }
                    contentContainerStyle={[
                        styles.content,
                        {
                            paddingBottom:
                                insets.bottom +
                                30,
                        },
                    ]}
                >
                    <RideDetailCard
                        ride={ride}
                    />

                    {/*
           * OFFERER VIEW
           */}
                    {isOfferer ? (
                        <>
                            <View
                                style={[
                                    styles.ownerCard,
                                    {
                                        backgroundColor:
                                            colors.surfaceContainer,
                                    },
                                ]}
                            >
                                <MaterialCommunityIcons
                                    name="car"
                                    size={22}
                                    color={
                                        colors.tint
                                    }
                                />

                                <View
                                    style={
                                        styles.ownerCardText
                                    }
                                >
                                    <AppText
                                        style={[
                                            styles.ownerTitle,
                                            {
                                                color:
                                                    colors.text,
                                                fontFamily:
                                                    Fonts?.sans,
                                            },
                                        ]}
                                    >
                                        You are offering
                                        this ride
                                    </AppText>

                                    <AppText
                                        style={[
                                            styles.ownerSubtitle,
                                            {
                                                color:
                                                    colors.icon,
                                                fontFamily:
                                                    Fonts?.sans,
                                            },
                                        ]}
                                    >
                                        {
                                            ride.availableSeats
                                        }{' '}
                                        {ride.availableSeats ===
                                            1
                                            ? 'seat'
                                            : 'seats'}{' '}
                                        remaining
                                    </AppText>
                                </View>
                            </View>

                            <View
                                style={
                                    styles.sectionHeader
                                }
                            >
                                <View>
                                    <AppText
                                        style={[
                                            styles.sectionTitle,
                                            {
                                                color:
                                                    colors.text,
                                                fontFamily:
                                                    Fonts?.sans,
                                            },
                                        ]}
                                    >
                                        Passenger Requests
                                    </AppText>

                                    <AppText
                                        style={[
                                            styles.sectionSubtitle,
                                            {
                                                color:
                                                    colors.icon,
                                                fontFamily:
                                                    Fonts?.sans,
                                            },
                                        ]}
                                    >
                                        {
                                            pendingRequests.length
                                        }{' '}
                                        pending
                                    </AppText>
                                </View>
                            </View>

                            {passengerRequestError ? (
                                <View
                                    style={[
                                        styles.requestErrorCard,
                                        {
                                            backgroundColor:
                                                colors.surfaceContainer,
                                        },
                                    ]}
                                >
                                    <MaterialCommunityIcons
                                        name="alert-circle-outline"
                                        size={20}
                                        color={
                                            colors.error
                                        }
                                    />

                                    <AppText
                                        style={[
                                            styles.requestErrorText,
                                            {
                                                color:
                                                    colors.error,
                                                fontFamily:
                                                    Fonts?.sans,
                                            },
                                        ]}
                                    >
                                        {
                                            passengerRequestError
                                        }
                                    </AppText>
                                </View>
                            ) : null}

                            {loadingPassengerRequests ? (
                                <View
                                    style={
                                        styles.requestsLoading
                                    }
                                >
                                    <ActivityIndicator
                                        color={
                                            colors.tint
                                        }
                                    />

                                    <AppText
                                        style={[
                                            styles.requestsLoadingText,
                                            {
                                                color:
                                                    colors.icon,
                                                fontFamily:
                                                    Fonts?.sans,
                                            },
                                        ]}
                                    >
                                        Loading requests
                                    </AppText>
                                </View>
                            ) : passengerRequests.length ===
                                0 ? (
                                <View
                                    style={[
                                        styles.noRequestsCard,
                                        {
                                            backgroundColor:
                                                colors.surfaceContainer,
                                        },
                                    ]}
                                >
                                    <MaterialCommunityIcons
                                        name="account-clock-outline"
                                        size={34}
                                        color={
                                            colors.icon
                                        }
                                    />

                                    <AppText
                                        style={[
                                            styles.noRequestsTitle,
                                            {
                                                color:
                                                    colors.text,
                                                fontFamily:
                                                    Fonts?.sans,
                                            },
                                        ]}
                                    >
                                        No passenger
                                        requests yet
                                    </AppText>

                                    <AppText
                                        style={[
                                            styles.noRequestsText,
                                            {
                                                color:
                                                    colors.icon,
                                                fontFamily:
                                                    Fonts?.sans,
                                            },
                                        ]}
                                    >
                                        Requests from
                                        people looking for
                                        this ride will
                                        appear here.
                                    </AppText>
                                </View>
                            ) : (
                                <>
                                    {pendingRequests.map(
                                        renderPassengerRequest,
                                    )}

                                    {acceptedRequests.length >
                                        0 && (
                                            <>
                                                <View
                                                    style={
                                                        styles.acceptedHeader
                                                    }
                                                >
                                                    <AppText
                                                        style={[
                                                            styles.sectionTitle,
                                                            {
                                                                color:
                                                                    colors.text,
                                                                fontFamily:
                                                                    Fonts?.sans,
                                                            },
                                                        ]}
                                                    >
                                                        Accepted
                                                        Passengers
                                                    </AppText>

                                                    <View
                                                        style={[
                                                            styles.countBadge,
                                                            {
                                                                backgroundColor:
                                                                    colors.surfaceContainer,
                                                            },
                                                        ]}
                                                    >
                                                        <AppText
                                                            style={[
                                                                styles.countText,
                                                                {
                                                                    color:
                                                                        colors.tint,
                                                                    fontFamily:
                                                                        Fonts?.sans,
                                                                },
                                                            ]}
                                                        >
                                                            {
                                                                acceptedRequests.length
                                                            }
                                                        </AppText>
                                                    </View>
                                                </View>

                                                {acceptedRequests.map(
                                                    renderPassengerRequest,
                                                )}
                                            </>
                                        )}
                                </>
                            )}

                            {ride.status ===
                                'full' && (
                                    <View
                                        style={[
                                            styles.fullCard,
                                            {
                                                backgroundColor:
                                                    colors.surfaceContainer,
                                            },
                                        ]}
                                    >
                                        <MaterialCommunityIcons
                                            name="account-group"
                                            size={22}
                                            color={
                                                colors.tint
                                            }
                                        />

                                        <AppText
                                            style={[
                                                styles.fullText,
                                                {
                                                    color:
                                                        colors.text,
                                                    fontFamily:
                                                        Fonts?.sans,
                                                },
                                            ]}
                                        >
                                            This ride is full.
                                        </AppText>
                                    </View>
                                )}

                            {showTracking && (
                                <TouchableOpacity
                                    onPress={() =>
                                        openRideTracking(
                                            ride.id,
                                        )
                                    }
                                    style={[
                                        styles.trackingButton,
                                        {
                                            backgroundColor:
                                                colors.tint,
                                        },
                                    ]}
                                >
                                    <MaterialCommunityIcons
                                        name="map-marker-path"
                                        size={21}
                                        color={
                                            colors.onPrimary
                                        }
                                    />

                                    <AppText
                                        style={[
                                            styles.trackingText,
                                            {
                                                color:
                                                    colors.onPrimary,
                                                fontFamily:
                                                    Fonts?.sans,
                                            },
                                        ]}
                                    >
                                        Open Live
                                        Tracking
                                    </AppText>
                                </TouchableOpacity>
                            )}
                        </>
                    ) : (
                        <>
                            {/*
               * PASSENGER VIEW
               */}
                            {request ? (
                                <View
                                    style={[
                                        styles.statusCard,
                                        {
                                            backgroundColor:
                                                colors.surfaceContainer,
                                        },
                                    ]}
                                >
                                    <MaterialCommunityIcons
                                        name={
                                            request.status ===
                                                'accepted'
                                                ? 'check-circle'
                                                : 'clock-outline'
                                        }
                                        size={22}
                                        color={
                                            colors.tint
                                        }
                                    />

                                    <AppText
                                        style={[
                                            styles.statusText,
                                            {
                                                color:
                                                    colors.text,
                                                fontFamily:
                                                    Fonts?.sans,
                                            },
                                        ]}
                                    >
                                        Request status:{' '}
                                        {request.status.toUpperCase()}
                                    </AppText>
                                </View>
                            ) : null}

                            {requestError ? (
                                <AppText
                                    style={[
                                        styles.requestError,
                                        {
                                            color:
                                                colors.error,
                                            fontFamily:
                                                Fonts?.sans,
                                        },
                                    ]}
                                >
                                    {requestError}
                                </AppText>
                            ) : null}

                            {showTracking && (
                                <TouchableOpacity
                                    onPress={() =>
                                        openRideTracking(
                                            ride.id,
                                        )
                                    }
                                    style={[
                                        styles.trackingButton,
                                        {
                                            backgroundColor:
                                                colors.tint,
                                        },
                                    ]}
                                >
                                    <MaterialCommunityIcons
                                        name="map-marker-path"
                                        size={21}
                                        color={
                                            colors.onPrimary
                                        }
                                    />

                                    <AppText
                                        style={[
                                            styles.trackingText,
                                            {
                                                color:
                                                    colors.onPrimary,
                                                fontFamily:
                                                    Fonts?.sans,
                                            },
                                        ]}
                                    >
                                        Open Live
                                        Tracking
                                    </AppText>
                                </TouchableOpacity>
                            )}

                            <RideRequestButton
                                request={request}
                                loading={
                                    loadingRequest ||
                                    submitting
                                }
                                disabled={
                                    ride.status !==
                                    'open' ||
                                    ride.availableSeats <
                                    1
                                }
                                onRequest={
                                    handleRequest
                                }
                                onCancel={
                                    handleCancel
                                }
                            />
                        </>
                    )}
                </ScrollView>
            )}
        </AppView>
    );
}

const styles =
    StyleSheet.create({
        container: {
            flex: 1,
        },

        header: {
            minHeight: 78,
            flexDirection: 'row',
            alignItems: 'center',
            borderBottomWidth: 1,
            paddingHorizontal: 16,
            paddingBottom: 10,
        },

        backButton: {
            width: 44,
            height: 44,
            borderWidth: 1,
            borderRadius: 14,
            alignItems: 'center',
            justifyContent: 'center',
        },

        headerTitle: {
            flex: 1,
            textAlign: 'center',
            fontSize: 17,
            fontWeight: '800',
        },

        headerSpacer: {
            width: 44,
        },

        centerState: {
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            padding: 28,
        },

        errorText: {
            marginTop: 14,
            fontSize: 15,
            textAlign: 'center',
        },

        retryButton: {
            marginTop: 18,
            minHeight: 46,
            borderRadius: 14,
            justifyContent: 'center',
            paddingHorizontal: 20,
        },

        retryText: {
            fontSize: 14,
            fontWeight: '800',
        },

        content: {
            padding: 16,
            gap: 14,
        },

        ownerCard: {
            minHeight: 72,
            flexDirection: 'row',
            alignItems: 'center',
            borderRadius: 17,
            paddingHorizontal: 15,
            gap: 12,
        },

        ownerCardText: {
            flex: 1,
        },

        ownerTitle: {
            fontSize: 14,
            fontWeight: '800',
        },

        ownerSubtitle: {
            marginTop: 3,
            fontSize: 12,
        },

        sectionHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent:
                'space-between',
            marginTop: 4,
        },

        sectionTitle: {
            fontSize: 17,
            fontWeight: '900',
        },

        sectionSubtitle: {
            marginTop: 3,
            fontSize: 12,
        },

        passengerCard: {
            borderWidth: 1,
            borderRadius: 18,
            padding: 14,
            gap: 14,
        },

        passengerHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 11,
        },

        avatar: {
            width: 46,
            height: 46,
            borderRadius: 23,
            alignItems: 'center',
            justifyContent: 'center',
        },

        passengerInfo: {
            flex: 1,
        },

        passengerName: {
            fontSize: 15,
            fontWeight: '800',
        },

        passengerStatus: {
            marginTop: 3,
            fontSize: 12,
        },

        requestActions: {
            flexDirection: 'row',
            gap: 10,
        },

        declineButton: {
            flex: 1,
            minHeight: 46,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderRadius: 14,
            gap: 6,
        },

        declineText: {
            fontSize: 13,
            fontWeight: '800',
        },

        acceptButton: {
            flex: 1,
            minHeight: 46,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 14,
            gap: 6,
        },

        acceptText: {
            fontSize: 13,
            fontWeight: '800',
        },

        disabledButton: {
            opacity: 0.5,
        },

        acceptedHeader: {
            marginTop: 8,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
        },

        countBadge: {
            minWidth: 28,
            height: 28,
            borderRadius: 14,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 8,
        },

        countText: {
            fontSize: 12,
            fontWeight: '900',
        },

        requestErrorCard: {
            flexDirection: 'row',
            alignItems: 'center',
            borderRadius: 14,
            padding: 12,
            gap: 8,
        },

        requestErrorText: {
            flex: 1,
            fontSize: 12,
            lineHeight: 17,
        },

        requestsLoading: {
            minHeight: 120,
            alignItems: 'center',
            justifyContent: 'center',
        },

        requestsLoadingText: {
            marginTop: 8,
            fontSize: 12,
        },

        noRequestsCard: {
            minHeight: 180,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 18,
            padding: 24,
        },

        noRequestsTitle: {
            marginTop: 10,
            fontSize: 15,
            fontWeight: '800',
        },

        noRequestsText: {
            marginTop: 5,
            maxWidth: 250,
            fontSize: 12,
            lineHeight: 18,
            textAlign: 'center',
        },

        fullCard: {
            minHeight: 54,
            flexDirection: 'row',
            alignItems: 'center',
            borderRadius: 16,
            paddingHorizontal: 14,
            gap: 9,
        },

        fullText: {
            fontSize: 13,
            fontWeight: '800',
        },

        statusCard: {
            minHeight: 50,
            flexDirection: 'row',
            alignItems: 'center',
            borderRadius: 16,
            paddingHorizontal: 14,
            gap: 9,
        },

        statusText: {
            flex: 1,
            fontSize: 13,
            fontWeight: '800',
        },

        requestError: {
            fontSize: 13,
            lineHeight: 18,
            textAlign: 'center',
        },

        trackingButton: {
            minHeight: 54,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 17,
            gap: 9,
        },

        trackingText: {
            fontSize: 15,
            fontWeight: '800',
        },
    });