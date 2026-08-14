import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    StyleSheet,
    TouchableOpacity,
    View,
} from 'react-native';
import type { Region } from 'react-native-maps';
import MapView, { Marker } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/text';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function FullRideMapScreen() {
    const theme = useColorScheme() ?? 'light';
    const colors = Colors[theme];
    const insets = useSafeAreaInsets();

    const [region, setRegion] = useState<Region | null>(null);
    const [loading, setLoading] = useState(true);
    const [errorMessage, setErrorMessage] =
        useState<string | null>(null);

    useEffect(() => {
        loadLocation();
    }, []);

    async function loadLocation() {
        setLoading(true);
        setErrorMessage(null);

        try {
            const permission =
                await Location.requestForegroundPermissionsAsync();

            if (permission.status !== 'granted') {
                setErrorMessage(
                    'Location permission is required to show the map.',
                );
                return;
            }

            const location =
                await Location.getCurrentPositionAsync({
                    accuracy: Location.Accuracy.Balanced,
                });

            setRegion({
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
                latitudeDelta: 0.04,
                longitudeDelta: 0.04,
            });
        } catch (error) {
            setErrorMessage(
                error instanceof Error
                    ? error.message
                    : 'Unable to load your current location.',
            );
        } finally {
            setLoading(false);
        }
    }

    return (
        <View
            style={[
                styles.container,
                {
                    backgroundColor: colors.background,
                },
            ]}
        >
            {loading && (
                <View
                    style={[
                        styles.statusContainer,
                        {
                            backgroundColor: colors.surfaceContainerHigh,
                        },
                    ]}
                >
                    <ActivityIndicator
                        size="large"
                        color={colors.tint}
                    />

                    <AppText
                        style={[
                            styles.statusText,
                            {
                                color: colors.icon,
                                fontFamily: Fonts?.sans,
                            },
                        ]}
                    >
                        Loading map
                    </AppText>
                </View>
            )}

            {!loading && region && (
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

            {!loading && !region && (
                <View
                    style={[
                        styles.statusContainer,
                        {
                            backgroundColor: colors.surfaceContainerHigh,
                        },
                    ]}
                >
                    <MaterialCommunityIcons
                        name="map-marker-off-outline"
                        size={38}
                        color={colors.icon}
                    />

                    <AppText
                        style={[
                            styles.errorTitle,
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
                            styles.statusText,
                            {
                                color: colors.icon,
                                fontFamily: Fonts?.sans,
                            },
                        ]}
                    >
                        {errorMessage}
                    </AppText>

                    <TouchableOpacity
                        onPress={loadLocation}
                        style={[
                            styles.retryButton,
                            {
                                backgroundColor: colors.tint,
                            },
                        ]}
                    >
                        <MaterialCommunityIcons
                            name="refresh"
                            size={19}
                            color={colors.onPrimary}
                        />

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
            )}

            <View
                style={[
                    styles.topControls,
                    {
                        paddingTop: insets.top + 10,
                    },
                ]}
            >
                <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Return to ride dashboard"
                    onPress={() => router.back()}
                    style={[
                        styles.floatingButton,
                        {
                            backgroundColor: colors.cardBackground,
                            borderColor: colors.outlineVariant,
                        },
                    ]}
                >
                    <MaterialCommunityIcons
                        name="arrow-left"
                        size={25}
                        color={colors.text}
                    />
                </TouchableOpacity>

                <View
                    style={[
                        styles.titlePill,
                        {
                            backgroundColor: colors.cardBackground,
                            borderColor: colors.outlineVariant,
                        },
                    ]}
                >
                    <MaterialCommunityIcons
                        name="map-outline"
                        size={20}
                        color={colors.tint}
                    />

                    <AppText
                        numberOfLines={1}
                        style={[
                            styles.title,
                            {
                                color: colors.text,
                                fontFamily: Fonts?.sans,
                            },
                        ]}
                    >
                        Ride Map
                    </AppText>
                </View>
            </View>

            <View
                style={[
                    styles.bottomControls,
                    {
                        paddingBottom: insets.bottom + 14,
                    },
                ]}
            >
                <TouchableOpacity
                    accessibilityRole="button"
                    onPress={() => router.push('/ride/find')}
                    style={[
                        styles.secondaryAction,
                        {
                            backgroundColor: colors.cardBackground,
                            borderColor: colors.outlineVariant,
                        },
                    ]}
                >
                    <MaterialCommunityIcons
                        name="car-search-outline"
                        size={21}
                        color={colors.tint}
                    />

                    <AppText
                        style={[
                            styles.secondaryActionText,
                            {
                                color: colors.text,
                                fontFamily: Fonts?.sans,
                            },
                        ]}
                    >
                        Find Ride
                    </AppText>
                </TouchableOpacity>

                <TouchableOpacity
                    accessibilityRole="button"
                    onPress={() => router.push('/ride/offer')}
                    style={[
                        styles.primaryAction,
                        {
                            backgroundColor: colors.tint,
                        },
                    ]}
                >
                    <MaterialCommunityIcons
                        name="car-multiple"
                        size={21}
                        color={colors.onPrimary}
                    />

                    <AppText
                        style={[
                            styles.primaryActionText,
                            {
                                color: colors.onPrimary,
                                fontFamily: Fonts?.sans,
                            },
                        ]}
                    >
                        Offer Ride
                    </AppText>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    statusContainer: {
        ...StyleSheet.absoluteFillObject,
        paddingHorizontal: 28,
        alignItems: 'center',
        justifyContent: 'center',
    },
    statusText: {
        marginTop: 10,
        fontSize: 14,
        lineHeight: 20,
        textAlign: 'center',
    },
    errorTitle: {
        marginTop: 12,
        fontSize: 18,
        fontWeight: '700',
    },
    retryButton: {
        marginTop: 18,
        minHeight: 46,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 14,
        paddingHorizontal: 20,
        gap: 8,
    },
    retryText: {
        fontSize: 14,
        fontWeight: '700',
    },
    topControls: {
        position: 'absolute',
        top: 0,
        right: 14,
        left: 14,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    floatingButton: {
        width: 48,
        height: 48,
        borderWidth: 1,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    titlePill: {
        flex: 1,
        minHeight: 48,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderRadius: 16,
        paddingHorizontal: 14,
        gap: 9,
    },
    title: {
        flex: 1,
        fontSize: 16,
        fontWeight: '700',
    },
    bottomControls: {
        position: 'absolute',
        right: 14,
        bottom: 0,
        left: 14,
        flexDirection: 'row',
        gap: 10,
    },
    secondaryAction: {
        flex: 1,
        minHeight: 54,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderRadius: 16,
        gap: 8,
    },
    secondaryActionText: {
        fontSize: 14,
        fontWeight: '700',
    },
    primaryAction: {
        flex: 1,
        minHeight: 54,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 16,
        gap: 8,
    },
    primaryActionText: {
        fontSize: 14,
        fontWeight: '700',
    },
});