import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
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
    OffererPassengerRequest,
    subscribeToRidePassengerRequests,
} from '@/services/offerer-ride-requests-service';

import {
    cancelRide,
    completeRide,
    startRide,
} from '@/services/ride-lifecycle-service';

import { supabase } from '@/lib/supabase';
import { stopDriverLocation } from '@/services/ride-tracking-service';
import { fetchRideById } from '@/services/rides-service';
import { RideOffer } from '@/types/rides';

export default function RideDetailsScreen() {
    const { id } = useLocalSearchParams<{ id?: string }>();
    const rideId = typeof id === 'string' ? id : '';

    const theme = useColorScheme() ?? 'light';
    const colors = Colors[theme];
    const insets = useSafeAreaInsets();

    const [ride, setRide] = useState<RideOffer | null>(null);
    const [isOfferer, setIsOfferer] = useState(false);
    const [requests, setRequests] = useState<OffererPassengerRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingRequests, setLoadingRequests] = useState(false);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [tripBusy, setTripBusy] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const {
        request,
        loading: requestLoading,
        submitting,
        errorMessage: requestError,
        requestSeat,
        cancelSeatRequest,
    } = useRideRequest(isOfferer ? null : ride);

    const loadRide = useCallback(async () => {
        if (!rideId) {
            setError('Ride ID is missing.');
            setLoading(false);
            return;
        }

        try {
            setError(null);

            const loadedRide = await fetchRideById(rideId);

            if (!loadedRide) {
                throw new Error('Ride not found.');
            }

            setRide(loadedRide);

            const {
                data: { user },
            } = await supabase.auth.getUser();

            setIsOfferer(user?.id === loadedRide.driverId);
        } catch (e) {
            setError(
                e instanceof Error ? e.message : 'Could not load ride.',
            );
        } finally {
            setLoading(false);
        }
    }, [rideId]);

    const loadRequests = useCallback(async () => {
        if (!rideId || !isOfferer) return;

        try {
            setLoadingRequests(true);
            setRequests(await fetchRidePassengerRequests(rideId));
        } catch (e) {
            Alert.alert(
                'Could not load requests',
                e instanceof Error ? e.message : 'Something went wrong.',
            );
        } finally {
            setLoadingRequests(false);
        }
    }, [rideId, isOfferer]);

    useEffect(() => {
        void loadRide();
    }, [loadRide]);

    useEffect(() => {
        if (isOfferer) void loadRequests();
    }, [isOfferer, loadRequests]);

    useEffect(() => {
        if (!isOfferer || !rideId) return;

        return subscribeToRidePassengerRequests(rideId, () => {
            void loadRequests();
            void loadRide();
        });
    }, [isOfferer, rideId, loadRequests, loadRide]);

    function goBack() {
        router.canGoBack()
            ? router.back()
            : router.replace('/(tabs)/rides');
    }

    async function refresh() {
        setRefreshing(true);

        await loadRide();

        if (isOfferer) {
            await loadRequests();
        }

        setRefreshing(false);
    }

    async function handleRequest() {
        try {
            await requestSeat();

            Alert.alert(
                'Request sent',
                'The person offering this ride can now accept or decline your request.',
            );
        } catch { }
    }

    function handleCancelRequest() {
        Alert.alert(
            'Cancel request?',
            'You can choose another ride after cancelling.',
            [
                { text: 'Keep Request', style: 'cancel' },
                {
                    text: 'Cancel Request',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await cancelSeatRequest();
                        } catch { }
                    },
                },
            ],
        );
    }

    async function manageRequest(
        item: OffererPassengerRequest,
        action: 'accept' | 'decline',
    ) {
        setBusyId(item.id);

        try {
            if (action === 'accept') {
                await acceptPassengerRequest(item.id);
            } else {
                await declinePassengerRequest(item.id);
            }

            await Promise.all([loadRide(), loadRequests()]);
        } catch (e) {
            Alert.alert(
                `Could not ${action} request`,
                e instanceof Error ? e.message : 'Something went wrong.',
            );
        } finally {
            setBusyId(null);
        }
    }

    function confirmRequest(
        item: OffererPassengerRequest,
        action: 'accept' | 'decline',
    ) {
        Alert.alert(
            `${action === 'accept' ? 'Accept' : 'Decline'} request?`,
            `${action === 'accept' ? 'Accept' : 'Decline'} ${item.requesterName
            }?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: action === 'accept' ? 'Accept' : 'Decline',
                    style: action === 'decline' ? 'destructive' : 'default',
                    onPress: () => void manageRequest(item, action),
                },
            ],
        );
    }

    async function handleStartTrip() {
        if (!ride) return;

        setTripBusy(true);

        try {
            await startRide(ride.id);
            await loadRide();

            openRideTracking(ride.id);
        } catch (e) {
            Alert.alert(
                'Could not start trip',
                e instanceof Error ? e.message : 'Something went wrong.',
            );
        } finally {
            setTripBusy(false);
        }
    }

    function handleCompleteTrip() {
        if (!ride) return;

        Alert.alert(
            'Complete trip?',
            'This ride will move to your history.',
            [
                { text: 'Not Yet', style: 'cancel' },
                {
                    text: 'Complete',
                    onPress: async () => {
                        setTripBusy(true);

                        try {
                            await stopDriverLocation(ride.id);
                            await completeRide(ride.id);

                            router.replace('/(tabs)/rides');
                        } catch (e) {
                            Alert.alert(
                                'Could not complete trip',
                                e instanceof Error ? e.message : 'Something went wrong.',
                            );
                        } finally {
                            setTripBusy(false);
                        }
                    },
                },
            ],
        );
    }

    function handleCancelRide() {
        if (!ride) return;

        Alert.alert(
            'Cancel ride?',
            'Passenger requests will also be cancelled.',
            [
                { text: 'Keep Ride', style: 'cancel' },
                {
                    text: 'Cancel Ride',
                    style: 'destructive',
                    onPress: async () => {
                        setTripBusy(true);

                        try {
                            if (ride.status === 'in_progress') {
                                await stopDriverLocation(ride.id);
                            }

                            await cancelRide(ride.id);

                            router.replace('/(tabs)/rides');
                        } catch (e) {
                            Alert.alert(
                                'Could not cancel ride',
                                e instanceof Error ? e.message : 'Something went wrong.',
                            );
                        } finally {
                            setTripBusy(false);
                        }
                    },
                },
            ],
        );
    }

    const pending = requests.filter((r) => r.status === 'pending');
    const accepted = requests.filter((r) => r.status === 'accepted');

    const passengerCanTrack =
        request?.status === 'accepted' &&
        ride?.status === 'in_progress';

    function renderPassengerRequest(item: OffererPassengerRequest) {
        const isAccepted = item.status === 'accepted';
        const busy = busyId === item.id;

        return (
            <View
                key={item.id}
                style={[
                    styles.requestCard,
                    {
                        backgroundColor: colors.cardBackground,
                        borderColor: colors.outlineVariant,
                    },
                ]}
            >
                <View style={styles.requestHeader}>
                    <View
                        style={[
                            styles.avatar,
                            { backgroundColor: colors.surfaceContainer },
                        ]}
                    >
                        <MaterialCommunityIcons
                            name="account"
                            size={24}
                            color={colors.tint}
                        />
                    </View>

                    <View style={{ flex: 1 }}>
                        <AppText
                            style={[
                                styles.name,
                                { color: colors.text, fontFamily: Fonts?.sans },
                            ]}
                        >
                            {item.requesterName}
                        </AppText>

                        <AppText
                            style={[
                                styles.smallText,
                                { color: colors.icon, fontFamily: Fonts?.sans },
                            ]}
                        >
                            {isAccepted ? 'Accepted passenger' : 'Pending request'}
                        </AppText>
                    </View>

                    {isAccepted && (
                        <MaterialCommunityIcons
                            name="check-circle"
                            size={24}
                            color={colors.tint}
                        />
                    )}
                </View>

                {!isAccepted && (
                    <View style={styles.requestActions}>
                        <TouchableOpacity
                            disabled={busy}
                            onPress={() => confirmRequest(item, 'decline')}
                            style={[
                                styles.outlineButton,
                                { borderColor: colors.error },
                            ]}
                        >
                            <AppText style={{ color: colors.error, fontWeight: '700' }}>
                                Decline
                            </AppText>
                        </TouchableOpacity>

                        <TouchableOpacity
                            disabled={
                                busy ||
                                ride?.status !== 'open' ||
                                (ride?.availableSeats ?? 0) < 1
                            }
                            onPress={() => confirmRequest(item, 'accept')}
                            style={[
                                styles.actionButton,
                                { backgroundColor: colors.tint },
                            ]}
                        >
                            {busy ? (
                                <ActivityIndicator color={colors.onPrimary} />
                            ) : (
                                <AppText
                                    style={{
                                        color: colors.onPrimary,
                                        fontWeight: '700',
                                    }}
                                >
                                    Accept
                                </AppText>
                            )}
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        );
    }

    if (loading) {
        return (
            <AppView style={styles.center}>
                <ActivityIndicator size="large" color={colors.tint} />
            </AppView>
        );
    }

    if (error || !ride) {
        return (
            <AppView style={styles.center}>
                <AppText>{error ?? 'Ride not found.'}</AppText>
            </AppView>
        );
    }

    return (
        <AppView
            style={[styles.container, { backgroundColor: colors.background }]}
        >
            <View
                style={[
                    styles.header,
                    {
                        paddingTop: insets.top + 10,
                        backgroundColor: colors.cardBackground,
                        borderBottomColor: colors.outlineVariant,
                    },
                ]}
            >
                <TouchableOpacity onPress={goBack} style={styles.back}>
                    <MaterialCommunityIcons
                        name="arrow-left"
                        size={24}
                        color={colors.text}
                    />
                </TouchableOpacity>

                <AppText
                    style={[
                        styles.title,
                        { color: colors.text, fontFamily: Fonts?.sans },
                    ]}
                >
                    Ride Details
                </AppText>

                <View style={styles.back} />
            </View>

            <ScrollView
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={refresh}
                        tintColor={colors.tint}
                    />
                }
                contentContainerStyle={[
                    styles.content,
                    { paddingBottom: insets.bottom + 30 },
                ]}
            >
                <RideDetailCard ride={ride} />

                {isOfferer ? (
                    <>
                        <View
                            style={[
                                styles.infoCard,
                                { backgroundColor: colors.surfaceContainer },
                            ]}
                        >
                            <MaterialCommunityIcons
                                name="car-outline"
                                size={22}
                                color={colors.tint}
                            />

                            <View style={{ flex: 1 }}>
                                <AppText style={[styles.name, { color: colors.text }]}>
                                    You are offering this ride
                                </AppText>

                                <AppText style={[styles.smallText, { color: colors.icon }]}>
                                    {ride.availableSeats} seat
                                    {ride.availableSeats === 1 ? '' : 's'} remaining
                                </AppText>
                            </View>
                        </View>

                        <AppText style={[styles.sectionTitle, { color: colors.text }]}>
                            Passenger Requests ({pending.length})
                        </AppText>

                        {loadingRequests ? (
                            <ActivityIndicator color={colors.tint} />
                        ) : pending.length === 0 ? (
                            <AppText style={[styles.emptyText, { color: colors.icon }]}>
                                No pending passenger requests.
                            </AppText>
                        ) : (
                            pending.map(renderPassengerRequest)
                        )}

                        {accepted.length > 0 && (
                            <>
                                <AppText
                                    style={[styles.sectionTitle, { color: colors.text }]}
                                >
                                    Accepted Passengers ({accepted.length})
                                </AppText>

                                {accepted.map(renderPassengerRequest)}
                            </>
                        )}

                        {(ride.status === 'open' || ride.status === 'full') && (
                            <TouchableOpacity
                                disabled={tripBusy}
                                onPress={handleStartTrip}
                                style={[
                                    styles.mainButton,
                                    { backgroundColor: colors.tint },
                                ]}
                            >
                                <MaterialCommunityIcons
                                    name="navigation"
                                    size={20}
                                    color={colors.onPrimary}
                                />
                                <AppText
                                    style={[styles.mainButtonText, { color: colors.onPrimary }]}
                                >
                                    Start Trip
                                </AppText>
                            </TouchableOpacity>
                        )}

                        {ride.status === 'in_progress' && (
                            <>
                                <TouchableOpacity
                                    onPress={() => openRideTracking(ride.id)}
                                    style={[
                                        styles.mainButton,
                                        { backgroundColor: colors.tint },
                                    ]}
                                >
                                    <MaterialCommunityIcons
                                        name="map-marker-path"
                                        size={20}
                                        color={colors.onPrimary}
                                    />
                                    <AppText
                                        style={[
                                            styles.mainButtonText,
                                            { color: colors.onPrimary },
                                        ]}
                                    >
                                        Open Live Tracking
                                    </AppText>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    disabled={tripBusy}
                                    onPress={handleCompleteTrip}
                                    style={[
                                        styles.mainButton,
                                        { backgroundColor: colors.tint },
                                    ]}
                                >
                                    <AppText
                                        style={[
                                            styles.mainButtonText,
                                            { color: colors.onPrimary },
                                        ]}
                                    >
                                        Complete Trip
                                    </AppText>
                                </TouchableOpacity>
                            </>
                        )}

                        {!['completed', 'cancelled'].includes(ride.status) && (
                            <TouchableOpacity
                                disabled={tripBusy}
                                onPress={handleCancelRide}
                                style={[
                                    styles.cancelButton,
                                    { borderColor: colors.error },
                                ]}
                            >
                                <AppText
                                    style={{ color: colors.error, fontWeight: '700' }}
                                >
                                    Cancel Ride
                                </AppText>
                            </TouchableOpacity>
                        )}
                    </>
                ) : (
                    <>
                        {request && (
                            <View
                                style={[
                                    styles.infoCard,
                                    { backgroundColor: colors.surfaceContainer },
                                ]}
                            >
                                <MaterialCommunityIcons
                                    name={
                                        request.status === 'accepted'
                                            ? 'check-circle'
                                            : 'clock-outline'
                                    }
                                    size={22}
                                    color={colors.tint}
                                />

                                <AppText style={{ color: colors.text, fontWeight: '700' }}>
                                    Request: {request.status.toUpperCase()}
                                </AppText>
                            </View>
                        )}

                        {requestError && (
                            <AppText style={{ color: colors.error, textAlign: 'center' }}>
                                {requestError}
                            </AppText>
                        )}

                        {passengerCanTrack && (
                            <TouchableOpacity
                                onPress={() => openRideTracking(ride.id)}
                                style={[
                                    styles.mainButton,
                                    { backgroundColor: colors.tint },
                                ]}
                            >
                                <MaterialCommunityIcons
                                    name="map-marker-path"
                                    size={20}
                                    color={colors.onPrimary}
                                />
                                <AppText
                                    style={[
                                        styles.mainButtonText,
                                        { color: colors.onPrimary },
                                    ]}
                                >
                                    Open Live Tracking
                                </AppText>
                            </TouchableOpacity>
                        )}

                        <RideRequestButton
                            request={request}
                            loading={requestLoading || submitting}
                            disabled={
                                ride.status !== 'open' ||
                                ride.availableSeats < 1
                            }
                            onRequest={handleRequest}
                            onCancel={handleCancelRequest}
                        />
                    </>
                )}
            </ScrollView>
        </AppView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    center: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    header: {
        minHeight: 78,
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomWidth: 1,
        paddingHorizontal: 16,
        paddingBottom: 10,
    },
    back: {
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        flex: 1,
        textAlign: 'center',
        fontSize: 17,
        fontWeight: '700',
    },
    content: {
        padding: 16,
        gap: 14,
    },
    infoCard: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 16,
        padding: 14,
        gap: 10,
    },
    sectionTitle: {
        marginTop: 4,
        fontSize: 17,
        fontWeight: '700',
    },
    emptyText: {
        paddingVertical: 14,
        textAlign: 'center',
        fontSize: 13,
    },
    requestCard: {
        borderWidth: 1,
        borderRadius: 17,
        padding: 13,
        gap: 12,
    },
    requestHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    avatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
    },
    name: {
        fontSize: 14,
        fontWeight: '700',
    },
    smallText: {
        marginTop: 3,
        fontSize: 12,
    },
    requestActions: {
        flexDirection: 'row',
        gap: 10,
    },
    outlineButton: {
        flex: 1,
        minHeight: 44,
        borderWidth: 1,
        borderRadius: 13,
        alignItems: 'center',
        justifyContent: 'center',
    },
    actionButton: {
        flex: 1,
        minHeight: 44,
        borderRadius: 13,
        alignItems: 'center',
        justifyContent: 'center',
    },
    mainButton: {
        minHeight: 52,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 15,
        gap: 8,
    },
    mainButtonText: {
        fontSize: 14,
        fontWeight: '700',
    },
    cancelButton: {
        minHeight: 48,
        borderWidth: 1,
        borderRadius: 15,
        alignItems: 'center',
        justifyContent: 'center',
    },
});