import { AppState } from 'react-native';
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
    const [connectionMessage, setConnectionMessage] = useState<string | null>(null);
    const [now, setNow] = useState(() => Date.now());
    const notifiedArrival = useRef(false);

    useEffect(() => {
        const currentRideId = rideId;
        if (!currentRideId) {
            setLoading(false);
            return;
        }

        let active = true;
        let connected = false;
        let fetching = false;
        notifiedArrival.current = false;
        setDriverLocation(null);
        setErrorMessage(null);
        setConnectionMessage(null);
        setLoading(true);
        let passengerSubscription: Location.LocationSubscription | null =
            null;

        function receiveLocation(location: RideLocation | null) {
            if (!active) return;
            setDriverLocation((previous) => {
                if (previous?.updatedAt && location?.updatedAt && Date.parse(previous.updatedAt) > Date.parse(location.updatedAt)) return previous;
                return location;
            });
            setErrorMessage(null);
        }

        async function refreshLocation() {
            if (!active || fetching || !currentRideId) return;
            fetching = true;
            try {
                receiveLocation(await fetchLatestDriverLocation(currentRideId));
            } catch {
                if (active) setErrorMessage('Cannot refresh driver location. Check your connection; retrying automatically.');
            } finally {
                fetching = false;
            }
        }

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

                receiveLocation(latestLocation);
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
                                    if (!active) return;
                                    setPassengerLocation({
                                        latitude:
                                            position.coords.latitude,
                                        longitude:
                                            position.coords.longitude,
                                    });
                                },
                            );
                        if (!active) passengerSubscription.remove();
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
            receiveLocation,
            (isConnected) => {
                if (!active) return;
                connected = isConnected;
                setConnectionMessage(isConnected ? null : 'Live connection interrupted. Checking driver location every 10 seconds while reconnecting.');
                void refreshLocation();
            },
        );

        const timer = setInterval(() => {
            setNow(Date.now());
            if (!connected) void refreshLocation();
        }, 10_000);

        return () => {
            active = false;
            clearInterval(timer);
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
        Boolean(driverLocation?.isActive) && !isLocationStale(driverLocation?.updatedAt ?? null, now) && distanceKm != null && hasDriverArrived(distanceKm);

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
            ? !driverLocation.isActive || isLocationStale(driverLocation.updatedAt, now)
            : true,
        loading,
        errorMessage,
        connectionMessage,
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

    const generation = useRef(0);
    const wantsSharing = useRef(false);
    const pendingStart = useRef<Promise<boolean> | null>(null);

    const startSharing = useCallback(async (): Promise<boolean> => {
        if (!rideId || AppState.currentState !== 'active') return false;
        wantsSharing.current = true;
        if (subscriptionRef.current) return true;
        if (pendingStart.current) return pendingStart.current;
        const current = generation.current;
        setErrorMessage(null);
        const task = (async () => {
            try {
                const subscription = await startDriverLocationPublisher(rideId, location => {
                    if (generation.current === current) setLastLocation(location);
                });
                if (generation.current !== current || !wantsSharing.current) { subscription.remove(); return false; }
                subscriptionRef.current = subscription;
                setSharing(true);
                return true;
            } catch (error) {
                if (generation.current === current) setErrorMessage(error instanceof Error ? error.message : 'Could not start sharing.');
                return false;
            } finally { if (generation.current === current) pendingStart.current = null; }
        })();
        pendingStart.current = task;
        return task;
    }, [rideId]);

    const stopSharing = useCallback(async () => {
        wantsSharing.current = false;
        generation.current++;
        pendingStart.current = null;
        subscriptionRef.current?.remove();
        subscriptionRef.current = null;
        setSharing(false);
        if (rideId) {
            try { await stopDriverLocation(rideId); }
            catch (error) { setErrorMessage(error instanceof Error ? error.message : 'Could not stop sharing.'); }
        }
    }, [rideId]);

    useEffect(() => {
        const subscription = AppState.addEventListener('change', state => {
            if (state === 'active') {
                if (wantsSharing.current) void startSharing();
            } else {
                generation.current++;
                pendingStart.current = null;
                subscriptionRef.current?.remove();
                subscriptionRef.current = null;
                setSharing(false);
            }
        });
        return () => {
            wantsSharing.current = false;
            generation.current++;
            pendingStart.current = null;
            subscriptionRef.current?.remove();
            subscriptionRef.current = null;
            subscription.remove();
        };
    }, [startSharing]);

    return { sharing, lastLocation, errorMessage, startSharing, stopSharing };
}
