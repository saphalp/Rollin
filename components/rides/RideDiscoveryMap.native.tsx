import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, {
    Marker,
    Region,
} from 'react-native-maps';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export type ActivityMapItem = {
    id: string;
    title: string;
    location: string;
    dateTime: string | null;
    category: string | null;
    coordinate: {
        latitude: number;
        longitude: number;
    };
};

type RideDiscoveryMapProps = {
    activities: ActivityMapItem[];
    currentCoordinate: {
        latitude: number;
        longitude: number;
    } | null;
    selectedActivityId: string | null;
    onSelectActivity: (activityId: string) => void;
};

export function RideDiscoveryMap({
    activities,
    currentCoordinate,
    selectedActivityId,
    onSelectActivity,
}: RideDiscoveryMapProps) {
    const theme = useColorScheme() ?? 'light';
    const colors = Colors[theme];
    const mapRef = useRef<MapView>(null);

    const initialRegion = useMemo<Region | null>(() => {
        const center =
            currentCoordinate ?? activities[0]?.coordinate ?? null;

        if (!center) {
            return null;
        }

        return {
            latitude: center.latitude,
            longitude: center.longitude,
            latitudeDelta: 0.08,
            longitudeDelta: 0.08,
        };
    }, [activities, currentCoordinate]);

    useEffect(() => {
        const coordinates = [
            ...(currentCoordinate ? [currentCoordinate] : []),
            ...activities.map((activity) => activity.coordinate),
        ];

        if (coordinates.length < 2) {
            return;
        }

        const timeout = setTimeout(() => {
            mapRef.current?.fitToCoordinates(coordinates, {
                animated: true,
                edgePadding: {
                    top: 54,
                    right: 44,
                    bottom: 54,
                    left: 44,
                },
            });
        }, 250);

        return () => clearTimeout(timeout);
    }, [activities, currentCoordinate]);

    if (!initialRegion) {
        return (
            <View
                style={[
                    styles.emptyMap,
                    {
                        backgroundColor: colors.surfaceContainerHigh,
                    },
                ]}
            >
                <MaterialCommunityIcons
                    name="map-marker-off-outline"
                    size={34}
                    color={colors.icon}
                />
            </View>
        );
    }

    return (
        <MapView
            ref={mapRef}
            style={StyleSheet.absoluteFill}
            initialRegion={initialRegion}
            showsUserLocation={Boolean(currentCoordinate)}
            showsMyLocationButton={Boolean(currentCoordinate)}
        >
            {activities.map((activity) => {
                const selected = selectedActivityId === activity.id;

                return (
                    <Marker
                        key={activity.id}
                        coordinate={activity.coordinate}
                        title={activity.title}
                        description={activity.location}
                        onPress={() => onSelectActivity(activity.id)}
                        tracksViewChanges={false}
                    >
                        <View
                            style={[
                                styles.marker,
                                {
                                    backgroundColor: selected
                                        ? colors.tint
                                        : colors.secondaryContainer,
                                    borderColor: colors.cardBackground,
                                },
                            ]}
                        >
                            <MaterialCommunityIcons
                                name="calendar-marker"
                                size={20}
                                color={
                                    selected
                                        ? colors.onPrimary
                                        : colors.onSecondaryContainer
                                }
                            />
                        </View>
                    </Marker>
                );
            })}
        </MapView>
    );
}

const styles = StyleSheet.create({
    emptyMap: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    marker: {
        width: 38,
        height: 38,
        borderWidth: 3,
        borderRadius: 19,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
