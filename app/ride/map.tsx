
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
import { BackButton } from '@/components/ui/back-button';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

// Default location: Louisiana Tech University
const DEFAULT_REGION: Region = {
    latitude: 32.5299586,
    longitude: -92.6522165,
    latitudeDelta: 0.04,
    longitudeDelta: 0.04,
};

export default function FullRideMapScreen() {
    const theme = useColorScheme() ?? 'light';
    const colors = Colors[theme];
    const insets = useSafeAreaInsets();

    const [region, setRegion] = useState<Region>(DEFAULT_REGION);
    const [loading, setLoading] = useState(true);
    const [hasLocationPermission, setHasLocationPermission] =
        useState(false);

    useEffect(() => {
        void loadLocation();
    }, []);

    async function loadLocation() {
        setLoading(true);

        try {
            // Check permission without requesting it
            const permission =
                await Location.getForegroundPermissionsAsync();

            if (!permission.granted) {
                // Show the map at Louisiana Tech University
                setHasLocationPermission(false);
                setRegion(DEFAULT_REGION);
                return;
            }

            // Get current location only if permission exists
            const location =
                await Location.getCurrentPositionAsync({
                    accuracy: Location.Accuracy.Balanced,
                });

            setHasLocationPermission(true);

            setRegion({
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
                latitudeDelta: 0.04,
                longitudeDelta: 0.04,
            });
        } catch (error) {
            console.error('Unable to get current location:', error);

            // Still display the map if GPS fails
            setHasLocationPermission(false);
            setRegion(DEFAULT_REGION);
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

            {!loading && (
                <MapView
                    style={StyleSheet.absoluteFill}
                    initialRegion={region}
                    showsUserLocation={hasLocationPermission}
                    showsMyLocationButton={hasLocationPermission}
                >
                    {!hasLocationPermission && (
                        <Marker
                            coordinate={{
                                latitude: DEFAULT_REGION.latitude,
                                longitude: DEFAULT_REGION.longitude,
                            }}
                            title="Louisiana Tech University"
                            description="Default map location"
                            pinColor={colors.tint}
                        />
                    )}
                </MapView>
            )}

            {/* Top Navigation */}
            <View
                style={[
                    styles.topControls,
                    {
                        paddingTop: insets.top + 10,
                    },
                ]}
            >
                <BackButton
                    variant="floating"
                    accessibilityLabel="Return to ride dashboard"
                />

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

            {/* Bottom Navigation */}
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
        ...StyleSheet.absoluteFill,
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
    topControls: {
        position: 'absolute',
        top: 0,
        right: 14,
        left: 14,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
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
