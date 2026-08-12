import * as Location from 'expo-location';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { notifyDriverArrived } from '@/services/ride-notifications-service';
import {
    calculateDistanceKm,
    calculateEtaMinutes,
    fetchLatestDriverLocation,
    getCurrentCoordinates,
    hasDriverArrived,
    isLocationStale,
    startDriverLocationPublisher,
    stopDriverLocation,
    subscribeToDriverLocation,
} from '@/services/ride-tracking-service';
import { Coordinates, RideLocation } from '@/types/rides';

type PassengerOptions = {
    rideId: string | null;
    pickup: Coordinates | null;
    useDeviceLocation?: boolean;
};

export function useLiveRideLocation({
    rideId,
    pickup,
    useDeviceLocation = true,
}: PassengerOptions) {
    const [driverLocation, setDriverLocation] =
        useState<RideLocation | null>(null);
    const [passengerLocation, setPassengerLocation] =
        useState<Coordinates | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(
        null,
    );
    const [loading, setLoading] = useState(Boolean(rideId));
    const notifiedArrival = useRef(false);

    useEffect(() => {
        const currentRideId = rideId;
        if (!currentRideId) {
            setLoading(false);
            return;
        }

        let active = true;
        let passengerSubscription: Location.LocationSubscription | null =
            null;

        async function start() {
            if (!currentRideId) {
                return;
            }
            try {
                const [latestLocation, currentPassengerLocation] =
                    await Promise.all([
                        fetchLatestDriverLocation(currentRideId),
                        useDeviceLocation
                            ? getCurrentCoordinates().catch(() => null)
                            : Promise.resolve(null),
                    ]);

                if (!active) {
                    return;
                }

                setDriverLocation(latestLocation);
                setPassengerLocation(currentPassengerLocation);

                if (useDeviceLocation) {
                    try {
                        passengerSubscription =
                            await Location.watchPositionAsync(
                                {
                                    accuracy: Location.Accuracy.Balanced,
                                    timeInterval: 10_000,
                                    distanceInterval: 15,
                                },
                                (position) => {
                                    setPassengerLocation({
                                        latitude:
                                            position.coords.latitude,
                                        longitude:
                                            position.coords.longitude,
                                    });
                                },
                            );
                    } catch {
                        // Pickup coordinates remain the fallback destination.
                    }
                }
            } catch (error) {
                if (active) {
                    setErrorMessage(
                        error instanceof Error
                            ? error.message
                            : 'Could not start live tracking.',
                    );
                }
            } finally {
                if (active) {
                    setLoading(false);
                }
            }
        }

        void start();

        const unsubscribe = subscribeToDriverLocation(
            rideId,
            setDriverLocation,
        );

        return () => {
            active = false;
            passengerSubscription?.remove();
            unsubscribe();
        };
    }, [rideId, useDeviceLocation]);

    const target = useDeviceLocation
        ? passengerLocation ?? pickup
        : pickup;

    const distanceKm = useMemo(() => {
        if (!driverLocation || !target) {
            return null;
        }

        return calculateDistanceKm(
            {
                latitude: driverLocation.latitude,
                longitude: driverLocation.longitude,
            },
            target,
        );
    }, [driverLocation, target]);

    const etaMinutes = useMemo(() => {
        if (distanceKm == null || !driverLocation) {
            return null;
        }

        return calculateEtaMinutes(
            distanceKm,
            driverLocation.speedMps,
        );
    }, [distanceKm, driverLocation]);

    const arrived =
        distanceKm != null && hasDriverArrived(distanceKm);

    useEffect(() => {
        if (!arrived || notifiedArrival.current) {
            return;
        }

        notifiedArrival.current = true;
        void notifyDriverArrived().catch((error) => {
            console.warn('Arrival notification failed:', error);
        });
    }, [arrived]);

    return {
        driverLocation,
        passengerLocation,
        distanceKm,
        etaMinutes,
        arrived,
        stale: driverLocation
            ? isLocationStale(driverLocation.updatedAt)
            : true,
        loading,
        errorMessage,
    };
}

export function useDriverLocationPublisher(rideId: string | null) {
    const [sharing, setSharing] = useState(false);
    const [lastLocation, setLastLocation] =
        useState<RideLocation | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(
        null,
    );
    const subscriptionRef =
        useRef<Location.LocationSubscription | null>(null);

    const startSharing = useCallback(async () => {
        if (!rideId || subscriptionRef.current) {
            return;
        }

        setErrorMessage(null);

        try {
            subscriptionRef.current =
                await startDriverLocationPublisher(
                    rideId,
                    setLastLocation,
                );
            setSharing(true);
        } catch (error) {
            setErrorMessage(
                error instanceof Error
                    ? error.message
                    : 'Could not start location sharing.',
            );
        }
    }, [rideId]);

    const stopSharing = useCallback(async () => {
        subscriptionRef.current?.remove();
        subscriptionRef.current = null;
        setSharing(false);

        if (rideId) {
            try {
                await stopDriverLocation(rideId);
            } catch (error) {
                setErrorMessage(
                    error instanceof Error
                        ? error.message
                        : 'Could not stop location sharing.',
                );
            }
        }
    }, [rideId]);

    useEffect(() => {
        return () => {
            subscriptionRef.current?.remove();
        };
    }, []);

    return {
        sharing,
        lastLocation,
        errorMessage,
        startSharing,
        stopSharing,
    };
}
