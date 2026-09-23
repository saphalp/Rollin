import { useEffect, useMemo, useRef } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';

import { Coordinates, RideLocation } from '@/types/rides';

type Props = {
    fullScreen?: boolean;
    routeCoordinates?: Coordinates[];
    stops?: (Coordinates & { label: string })[];
    driverLocation: RideLocation | null;
    passengerLocation: Coordinates | null;
    pickup: Coordinates | null;
    destination: Coordinates | null;
};

export default function LiveRideMap({
    fullScreen = false,
    routeCoordinates,
    stops,
    driverLocation,
    passengerLocation,
    pickup,
    destination,
}: Props) {
    const mapRef = useRef<MapView | null>(null);

    const driverCoordinates = useMemo(() => driverLocation
        ? {
            latitude: driverLocation.latitude,
            longitude: driverLocation.longitude,
        }
        : null, [driverLocation]);

    useEffect(() => {
        const coordinates = [
            ...(routeCoordinates ?? []),
            driverCoordinates,
            passengerLocation,
            pickup,
            destination,
        ].filter((value): value is Coordinates => Boolean(value));

        if (coordinates.length >= 2) {
            mapRef.current?.fitToCoordinates(coordinates, {
                edgePadding: {
                    top: 70,
                    right: 50,
                    bottom: 70,
                    left: 50,
                },
                animated: true,
            });
        }
    }, [
        routeCoordinates, destination, driverCoordinates, passengerLocation, pickup,
    ]);

    const initial = driverCoordinates ??
        passengerLocation ??
        pickup ??
        destination ?? {
        latitude: 32.5232,
        longitude: -92.6379,
    };

    return (
        <View style={fullScreen ? { flex: 1 } : styles.wrapper}>
            <MapView
                ref={mapRef}
                style={styles.map}
                initialRegion={{
                    ...initial,
                    latitudeDelta: 0.04,
                    longitudeDelta: 0.04,
                }}
            >
                {driverCoordinates ? (
                    <Marker
                        coordinate={driverCoordinates}
                        title="Driver"
                        description="Last shared driver location"
                        anchor={{ x: 0.5, y: 0.5 }}
                        zIndex={10}
                    >
                        <View style={{ backgroundColor: '#165FD5', borderColor: '#fff', borderWidth: 3, borderRadius: 24, padding: 7 }}>
                            <MaterialCommunityIcons name="car" color="#fff" size={24} />
                        </View>
                    </Marker>
                ) : null}

                {passengerLocation ? (
                    <Marker
                        coordinate={passengerLocation}
                        title="Passenger"
                        description="Your current location"
                        pinColor="green"
                    />
                ) : null}

                {stops?.map((stop, i) => <Marker key={i} coordinate={stop} title={`${i + 1}. ${stop.label}`} pinColor="orange" />)}
                {!stops?.length && pickup ? (
                    <Marker
                        coordinate={pickup}
                        title="Pickup"
                        pinColor="orange"
                    />
                ) : null}

                {destination ? (
                    <Marker
                        coordinate={destination}
                        title="Destination"
                        pinColor="red"
                    />
                ) : null}

                {routeCoordinates && routeCoordinates.length >= 2 ? (
                    <Polyline
                        coordinates={routeCoordinates}
                        strokeWidth={4}
                        strokeColor="#165FD5"
                    />
                ) : null}
            </MapView>
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        height: 390,
        overflow: 'hidden',
        borderRadius: 22,
    },
    map: {
        ...StyleSheet.absoluteFill,
    },
});
