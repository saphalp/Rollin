import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';

import { Coordinates, RideLocation } from '@/types/rides';

type Props = {
    driverLocation: RideLocation | null;
    passengerLocation: Coordinates | null;
    pickup: Coordinates | null;
    destination: Coordinates | null;
};

export default function LiveRideMap({
    driverLocation,
    passengerLocation,
    pickup,
    destination,
}: Props) {
    const mapRef = useRef<MapView | null>(null);

    const driverCoordinates = driverLocation
        ? {
            latitude: driverLocation.latitude,
            longitude: driverLocation.longitude,
        }
        : null;

    useEffect(() => {
        const coordinates = [
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
        destination?.latitude,
        destination?.longitude,
        driverCoordinates?.latitude,
        driverCoordinates?.longitude,
        passengerLocation?.latitude,
        passengerLocation?.longitude,
        pickup?.latitude,
        pickup?.longitude,
    ]);

    const initial = driverCoordinates ??
        passengerLocation ??
        pickup ??
        destination ?? {
        latitude: 32.5232,
        longitude: -92.6379,
    };

    return (
        <View style={styles.wrapper}>
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
                        description="Live driver location"
                        pinColor="blue"
                    />
                ) : null}

                {passengerLocation ? (
                    <Marker
                        coordinate={passengerLocation}
                        title="Passenger"
                        description="Your current location"
                        pinColor="green"
                    />
                ) : null}

                {pickup ? (
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

                {driverCoordinates && (passengerLocation ?? pickup) ? (
                    <Polyline
                        coordinates={[
                            driverCoordinates,
                            (passengerLocation ?? pickup) as Coordinates,
                        ]}
                        strokeWidth={4}
                    />
                ) : null}

                {pickup && destination ? (
                    <Polyline
                        coordinates={[pickup, destination]}
                        strokeWidth={3}
                        lineDashPattern={[8, 6]}
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
        ...StyleSheet.absoluteFillObject,
    },
});
