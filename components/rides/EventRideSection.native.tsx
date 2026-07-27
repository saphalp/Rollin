import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    StyleSheet,
    TouchableOpacity,
    View
} from 'react-native';
import MapView, {
    LatLng,
    Marker,
    Region,
} from 'react-native-maps';

import { AppText } from '@/components/text';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type EventRideSectionProps = {
    eventId: string;
    eventTitle: string;

    // Pass these after the event has saved map coordinates.
    eventCoordinate?: LatLng | null;
};

export function EventRideSection({
    eventId,
    eventTitle,
    eventCoordinate = null,
}: EventRideSectionProps) {
    const theme = useColorScheme() ?? 'light';
    const colors = Colors[theme];

    const mapRef = useRef<MapView>(null);

    const [currentCoordinate, setCurrentCoordinate] =
        useState<LatLng | null>(null);
    const [region, setRegion] = useState<Region | null>(null);
    const [loadingLocation, setLoadingLocation] = useState(true);
    const [locationError, setLocationError] =
        useState<string | null>(null);

    useEffect(() => {
        let mounted = true;

        async function loadCurrentLocation() {
            try {
                const permission =
                    await Location.requestForegroundPermissionsAsync();

                if (!mounted) {
                    return;
                }

                if (permission.status !== 'granted') {
                    setLocationError(
                        'Location access is needed to show your position on the map.',
                    );
                    return;
                }

                const location =
                    await Location.getCurrentPositionAsync({
                        accuracy: Location.Accuracy.Balanced,
                    });

                if (!mounted) {
                    return;
                }

                const coordinate = {
                    latitude: location.coords.latitude,
                    longitude: location.coords.longitude,
                };

                setCurrentCoordinate(coordinate);

                const center = eventCoordinate ?? coordinate;

                setRegion({
                    latitude: center.latitude,
                    longitude: center.longitude,
                    latitudeDelta: 0.025,
                    longitudeDelta: 0.025,
                });
            } catch (error) {
                if (!mounted) {
                    return;
                }

                setLocationError(
                    error instanceof Error
                        ? error.message
                        : 'Unable to load your current location.',
                );
            } finally {
                if (mounted) {
                    setLoadingLocation(false);
                }
            }
        }

        loadCurrentLocation();

        return () => {
            mounted = false;
        };
    }, [eventCoordinate]);

    useEffect(() => {
        if (!currentCoordinate || !eventCoordinate) {
            return;
        }

        const timeout = setTimeout(() => {
            mapRef.current?.fitToCoordinates(
                [currentCoordinate, eventCoordinate],
                {
                    animated: true,
                    edgePadding: {
                        top: 55,
                        right: 55,
                        bottom: 55,
                        left: 55,
                    },
                },
            );
        }, 300);

        return () => clearTimeout(timeout);
    }, [currentCoordinate, eventCoordinate]);

    function openOfferRide() {
        router.push({
            pathname: '/events/[eventId]/offer-ride',
            params: {
                eventId,
                eventTitle,
            },
        });
    }

    function openAvailableRides() {
        router.push({
            pathname: '/events/[eventId]/rides',
            params: {
                eventId,
                eventTitle,
            },
        });
    }

    function retryLocation() {
        setLoadingLocation(true);
        setLocationError(null);

        Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
        })
            .then((location) => {
                const coordinate = {
                    latitude: location.coords.latitude,
                    longitude: location.coords.longitude,
                };

                setCurrentCoordinate(coordinate);

                const center = eventCoordinate ?? coordinate;

                setRegion({
                    latitude: center.latitude,
                    longitude: center.longitude,
                    latitudeDelta: 0.025,
                    longitudeDelta: 0.025,
                });
            })
            .catch((error) => {
                setLocationError(
                    error instanceof Error
                        ? error.message
                        : 'Unable to load your current location.',
                );
            })
            .finally(() => setLoadingLocation(false));
    }

    return (
        <View style={styles.container}>
            <View style={styles.headingRow}>
                <View style={styles.headingText}>
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
                        Offer seats or find someone attending this event.
                    </AppText>
                </View>
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
                {loadingLocation ? (
                    <View style={styles.mapState}>
                        <ActivityIndicator
                            size="large"
                            color={colors.tint}
                        />

                        <AppText
                            style={[
                                styles.stateText,
                                {
                                    color: colors.outline,
                                    fontFamily: Fonts?.sans,
                                },
                            ]}
                        >
                            Loading map…
                        </AppText>
                    </View>
                ) : region ? (
                    <MapView
                        ref={mapRef}
                        style={StyleSheet.absoluteFill}
                        initialRegion={region}
                        showsUserLocation
                        showsMyLocationButton
                    >
                        {eventCoordinate && (
                            <Marker
                                coordinate={eventCoordinate}
                                title={eventTitle}
                                description="Event destination"
                                pinColor="#E9861A"
                            />
                        )}
                    </MapView>
                ) : (
                    <View style={styles.mapState}>
                        <AppText
                            style={[
                                styles.stateTitle,
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
                                styles.stateText,
                                {
                                    color: colors.outline,
                                    fontFamily: Fonts?.sans,
                                },
                            ]}
                        >
                            {locationError ??
                                'Your location could not be loaded.'}
                        </AppText>

                        <TouchableOpacity
                            onPress={retryLocation}
                            style={[
                                styles.retryButton,
                                {
                                    borderColor: colors.tint,
                                },
                            ]}
                        >
                            <AppText
                                style={[
                                    styles.retryText,
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

            {!eventCoordinate && (
                <AppText
                    style={[
                        styles.coordinateNotice,
                        {
                            color: colors.outline,
                            fontFamily: Fonts?.sans,
                        },
                    ]}
                >
                    The event marker will appear after latitude and longitude
                    are saved for this event.
                </AppText>
            )}

            <View style={styles.buttonRow}>
                <TouchableOpacity
                    accessibilityRole="button"
                    onPress={openOfferRide}
                    style={[
                        styles.secondaryButton,
                        {
                            backgroundColor: colors.cardBackground,
                            borderColor: colors.tint,
                        },
                    ]}
                >
                    <AppText
                        style={[
                            styles.secondaryButtonText,
                            {
                                color: colors.tint,
                                fontFamily: Fonts?.sans,
                            },
                        ]}
                    >
                        Offer a Ride
                    </AppText>
                </TouchableOpacity>

                <TouchableOpacity
                    accessibilityRole="button"
                    onPress={openAvailableRides}
                    style={[
                        styles.primaryButton,
                        {
                            backgroundColor: colors.tint,
                        },
                    ]}
                >
                    <AppText
                        style={[
                            styles.primaryButtonText,
                            {
                                color: colors.onImageOverlay,
                                fontFamily: Fonts?.sans,
                            },
                        ]}
                    >
                        Find a Ride
                    </AppText>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        gap: 14,
    },
    headingRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    headingText: {
        flex: 1,
    },
    title: {
        fontSize: 20,
        fontWeight: '800',
    },
    subtitle: {
        marginTop: 3,
        fontSize: 13,
        lineHeight: 19,
    },
    mapCard: {
        height: 235,
        overflow: 'hidden',
        borderWidth: 1,
        borderRadius: 18,
    },
    mapState: {
        flex: 1,
        paddingHorizontal: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
    stateTitle: {
        fontSize: 17,
        fontWeight: '700',
    },
    stateText: {
        marginTop: 8,
        fontSize: 13,
        lineHeight: 19,
        textAlign: 'center',
    },
    retryButton: {
        marginTop: 14,
        borderWidth: 1,
        borderRadius: 12,
        paddingHorizontal: 18,
        paddingVertical: 10,
    },
    retryText: {
        fontSize: 14,
        fontWeight: '700',
    },
    coordinateNotice: {
        marginTop: -6,
        fontSize: 12,
        lineHeight: 17,
    },
    buttonRow: {
        flexDirection: 'row',
        gap: 12,
    },
    secondaryButton: {
        flex: 1,
        minHeight: 52,
        borderWidth: 1.5,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    secondaryButtonText: {
        fontSize: 15,
        fontWeight: '800',
    },
    primaryButton: {
        flex: 1,
        minHeight: 52,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    primaryButtonText: {
        fontSize: 15,
        fontWeight: '800',
    },
});