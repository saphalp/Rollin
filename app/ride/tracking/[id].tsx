import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import LiveRideMap from '@/components/rides/live-ride-map';
import { LiveRideStatus } from '@/components/rides/live-ride-status';
import { AppText } from '@/components/text';
import { AppView } from '@/components/view';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
    useDriverLocationPublisher,
    useLiveRideLocation,
} from '@/hooks/use-live-ride-location';
import { supabase } from '@/lib/supabase';
import { canAccessRideTracking } from '@/services/ride-requests-service';
import { fetchRideById } from '@/services/rides-service';
import { Coordinates, RideOffer } from '@/types/rides';

export default function RideTrackingScreen() {
    const params = useLocalSearchParams<{ id?: string }>();
    const rideId = typeof params.id === 'string' ? params.id : '';

    const theme = useColorScheme() ?? 'light';
    const colors = Colors[theme];
    const insets = useSafeAreaInsets();

    const [ride, setRide] = useState<RideOffer | null>(null);
    const [currentUserId, setCurrentUserId] = useState<string | null>(
        null,
    );
    const [authorized, setAuthorized] = useState(false);
    const [loadingScreen, setLoadingScreen] = useState(true);
    const [screenError, setScreenError] = useState<string | null>(
        null,
    );

    const pickup = useMemo<Coordinates | null>(() => {
        if (
            ride?.pickupLatitude == null ||
            ride.pickupLongitude == null
        ) {
            return null;
        }

        return {
            latitude: ride.pickupLatitude,
            longitude: ride.pickupLongitude,
        };
    }, [ride]);

    const destination = useMemo<Coordinates | null>(() => {
        if (
            ride?.destinationLatitude == null ||
            ride.destinationLongitude == null
        ) {
            return null;
        }

        return {
            latitude: ride.destinationLatitude,
            longitude: ride.destinationLongitude,
        };
    }, [ride]);

    const isDriver = currentUserId === ride?.driverId;

    const live = useLiveRideLocation({
        rideId: authorized ? rideId : null,
        pickup,
        useDeviceLocation: !isDriver,
    });

    const driverPublisher = useDriverLocationPublisher(
        authorized && currentUserId === ride?.driverId
            ? rideId
            : null,
    );

    const load = useCallback(async () => {
        if (!rideId) {
            setScreenError('Ride ID is missing.');
            setLoadingScreen(false);
            return;
        }

        try {
            const [
                loadedRide,
                {
                    data: { user },
                },
            ] = await Promise.all([
                fetchRideById(rideId),
                supabase.auth.getUser(),
            ]);

            if (!loadedRide) {
                throw new Error('This ride could not be found.');
            }

            if (!user) {
                throw new Error('You must be logged in.');
            }

            const allowed = await canAccessRideTracking(
                loadedRide.id,
                loadedRide.driverId,
            );

            if (!allowed) {
                throw new Error(
                    'Live tracking is available only to the driver and accepted passengers.',
                );
            }

            setRide(loadedRide);
            setCurrentUserId(user.id);
            setAuthorized(true);
        } catch (error) {
            setScreenError(
                error instanceof Error
                    ? error.message
                    : 'Could not open live tracking.',
            );
        } finally {
            setLoadingScreen(false);
        }
    }, [rideId]);

    useEffect(() => {
        void load();
    }, [load]);

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
                    onPress={() =>
                        router.canGoBack()
                            ? router.back()
                            : router.replace('/(tabs)/rides')
                    }
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

                <View style={styles.headerText}>
                    <AppText
                        style={[
                            styles.headerTitle,
                            {
                                color: colors.text,
                                fontFamily: Fonts?.sans,
                            },
                        ]}
                    >
                        Live Ride
                    </AppText>
                    <AppText
                        style={[
                            styles.headerSubtitle,
                            {
                                color: colors.icon,
                                fontFamily: Fonts?.sans,
                            },
                        ]}
                    >
                        Distance and approximate ETA
                    </AppText>
                </View>

                <View style={styles.headerSpacer} />
            </View>

            {loadingScreen ? (
                <View style={styles.centerState}>
                    <ActivityIndicator
                        size="large"
                        color={colors.tint}
                    />
                </View>
            ) : screenError || !ride ? (
                <View style={styles.centerState}>
                    <MaterialCommunityIcons
                        name="map-marker-alert-outline"
                        size={42}
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
                        {screenError ?? 'Live tracking is unavailable.'}
                    </AppText>
                </View>
            ) : (
                <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={[
                        styles.content,
                        { paddingBottom: insets.bottom + 30 },
                    ]}
                >
                    <LiveRideMap
                        driverLocation={
                            live.driverLocation ??
                            driverPublisher.lastLocation
                        }
                        passengerLocation={live.passengerLocation}
                        pickup={pickup}
                        destination={destination}
                    />

                    <LiveRideStatus
                        distanceKm={live.distanceKm}
                        etaMinutes={live.etaMinutes}
                        arrived={live.arrived}
                        stale={live.stale}
                    />

                    {live.errorMessage ? (
                        <AppText
                            style={[
                                styles.errorMessage,
                                {
                                    color: colors.error,
                                    fontFamily: Fonts?.sans,
                                },
                            ]}
                        >
                            {live.errorMessage}
                        </AppText>
                    ) : null}

                    {isDriver ? (
                        <View
                            style={[
                                styles.driverCard,
                                {
                                    backgroundColor:
                                        colors.cardBackground,
                                    borderColor:
                                        colors.outlineVariant,
                                },
                            ]}
                        >
                            <AppText
                                style={[
                                    styles.driverTitle,
                                    {
                                        color: colors.text,
                                        fontFamily: Fonts?.sans,
                                    },
                                ]}
                            >
                                Driver location sharing
                            </AppText>
                            <AppText
                                style={[
                                    styles.driverDescription,
                                    {
                                        color: colors.icon,
                                        fontFamily: Fonts?.sans,
                                    },
                                ]}
                            >
                                Start sharing when you begin driving.
                                Stop sharing when the ride ends.
                            </AppText>

                            <TouchableOpacity
                                onPress={
                                    driverPublisher.sharing
                                        ? driverPublisher.stopSharing
                                        : driverPublisher.startSharing
                                }
                                style={[
                                    styles.shareButton,
                                    {
                                        backgroundColor:
                                            driverPublisher.sharing
                                                ? colors.surfaceContainer
                                                : colors.tint,
                                        borderColor:
                                            driverPublisher.sharing
                                                ? colors.outlineVariant
                                                : colors.tint,
                                    },
                                ]}
                            >
                                <MaterialCommunityIcons
                                    name={
                                        driverPublisher.sharing
                                            ? 'stop-circle-outline'
                                            : 'crosshairs-gps'
                                    }
                                    size={21}
                                    color={
                                        driverPublisher.sharing
                                            ? colors.tint
                                            : colors.onPrimary
                                    }
                                />
                                <AppText
                                    style={[
                                        styles.shareText,
                                        {
                                            color:
                                                driverPublisher.sharing
                                                    ? colors.tint
                                                    : colors.onPrimary,
                                            fontFamily: Fonts?.sans,
                                        },
                                    ]}
                                >
                                    {driverPublisher.sharing
                                        ? 'Stop Sharing'
                                        : 'Start Sharing'}
                                </AppText>
                            </TouchableOpacity>

                            {driverPublisher.errorMessage ? (
                                <AppText
                                    style={[
                                        styles.errorMessage,
                                        {
                                            color: colors.error,
                                            fontFamily: Fonts?.sans,
                                        },
                                    ]}
                                >
                                    {driverPublisher.errorMessage}
                                </AppText>
                            ) : null}
                        </View>
                    ) : null}
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
        gap: 12,
    },
    backButton: {
        width: 44,
        height: 44,
        borderWidth: 1,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerText: {
        flex: 1,
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: '700',
    },
    headerSubtitle: {
        marginTop: 1,
        fontSize: 12,
    },
    headerSpacer: {
        width: 44,
    },
    centerState: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 30,
    },
    errorText: {
        marginTop: 14,
        fontSize: 15,
        lineHeight: 21,
        textAlign: 'center',
    },
    content: {
        padding: 16,
        gap: 14,
    },
    errorMessage: {
        fontSize: 13,
        lineHeight: 19,
        textAlign: 'center',
    },
    driverCard: {
        borderWidth: 1,
        borderRadius: 20,
        padding: 16,
    },
    driverTitle: {
        fontSize: 16,
        fontWeight: '700',
    },
    driverDescription: {
        marginTop: 4,
        fontSize: 12,
        lineHeight: 18,
    },
    shareButton: {
        minHeight: 52,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderRadius: 16,
        marginTop: 14,
        gap: 9,
    },
    shareText: {
        fontSize: 14,
        fontWeight: '700',
    },
});
