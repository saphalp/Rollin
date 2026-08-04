import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
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
import { fetchRideById } from '@/services/rides-service';
import { RideOffer } from '@/types/rides';

export default function RideDetailsScreen() {
    const params = useLocalSearchParams<{ id?: string }>();
    const rideId = typeof params.id === 'string' ? params.id : '';

    const theme = useColorScheme() ?? 'light';
    const colors = Colors[theme];
    const insets = useSafeAreaInsets();

    const [ride, setRide] = useState<RideOffer | null>(null);
    const [loadingRide, setLoadingRide] = useState(true);
    const [rideError, setRideError] = useState<string | null>(null);

    const {
        request,
        loading: loadingRequest,
        submitting,
        errorMessage: requestError,
        requestSeat,
        cancelSeatRequest,
    } = useRideRequest(ride);

    const loadRide = useCallback(async () => {
        if (!rideId) {
            setRideError('Ride ID is missing.');
            setLoadingRide(false);
            return;
        }

        setRideError(null);

        try {
            setRide(await fetchRideById(rideId));
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

    useEffect(() => {
        void loadRide();
    }, [loadRide]);

    function goBack() {
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/ride/available');
        }
    }

    async function handleRequest() {
        try {
            await requestSeat();
            Alert.alert(
                'Request sent',
                'The driver can now accept or reject your request.',
            );
        } catch {
            // The hook displays the actual error.
        }
    }

    async function handleCancel() {
        Alert.alert(
            'Cancel ride request?',
            'Your pending or accepted request will be cancelled.',
            [
                { text: 'Keep Request', style: 'cancel' },
                {
                    text: 'Cancel Request',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await cancelSeatRequest();
                        } catch {
                            // The hook displays the actual error.
                        }
                    },
                },
            ],
        );
    }

    const showTracking =
        request?.status === 'accepted' ||
        ride?.status === 'in_progress';

    return (
        <AppView
            style={[
                styles.container,
                { backgroundColor: colors.background },
            ]}
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
                <TouchableOpacity
                    onPress={goBack}
                    style={[
                        styles.backButton,
                        {
                            backgroundColor: colors.surfaceContainer,
                            borderColor: colors.outlineVariant,
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
                            fontFamily: Fonts?.sans,
                        },
                    ]}
                >
                    Ride Details
                </AppText>

                <View style={styles.headerSpacer} />
            </View>

            {loadingRide ? (
                <View style={styles.centerState}>
                    <ActivityIndicator
                        size="large"
                        color={colors.tint}
                    />
                </View>
            ) : rideError || !ride ? (
                <View style={styles.centerState}>
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
                                fontFamily: Fonts?.sans,
                            },
                        ]}
                    >
                        {rideError ?? 'This ride could not be found.'}
                    </AppText>
                    <TouchableOpacity
                        onPress={loadRide}
                        style={[
                            styles.retryButton,
                            { backgroundColor: colors.tint },
                        ]}
                    >
                        <AppText
                            style={[
                                styles.retryText,
                                {
                                    color: colors.onPrimary,
                                    fontFamily: Fonts?.sans,
                                },
                            ]}
                        >
                            Try Again
                        </AppText>
                    </TouchableOpacity>
                </View>
            ) : (
                <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={[
                        styles.content,
                        { paddingBottom: insets.bottom + 30 },
                    ]}
                >
                    <RideDetailCard ride={ride} />

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
                                    request.status === 'accepted'
                                        ? 'check-circle'
                                        : 'clock-outline'
                                }
                                size={22}
                                color={colors.tint}
                            />
                            <AppText
                                style={[
                                    styles.statusText,
                                    {
                                        color: colors.text,
                                        fontFamily: Fonts?.sans,
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
                                    color: colors.error,
                                    fontFamily: Fonts?.sans,
                                },
                            ]}
                        >
                            {requestError}
                        </AppText>
                    ) : null}

                    {showTracking ? (
                        <TouchableOpacity
                            onPress={() => openRideTracking(ride.id)}
                            style={[
                                styles.trackingButton,
                                { backgroundColor: colors.tint },
                            ]}
                        >
                            <MaterialCommunityIcons
                                name="map-marker-path"
                                size={21}
                                color={colors.onPrimary}
                            />
                            <AppText
                                style={[
                                    styles.trackingText,
                                    {
                                        color: colors.onPrimary,
                                        fontFamily: Fonts?.sans,
                                    },
                                ]}
                            >
                                Open Live Tracking
                            </AppText>
                        </TouchableOpacity>
                    ) : null}

                    <RideRequestButton
                        request={request}
                        loading={loadingRequest || submitting}
                        disabled={
                            ride.status !== 'open' ||
                            ride.availableSeats < 1
                        }
                        onRequest={handleRequest}
                        onCancel={handleCancel}
                    />
                </ScrollView>
            )}
        </AppView>
    );
}

const styles = StyleSheet.create({
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
