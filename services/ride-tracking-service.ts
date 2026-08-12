import * as Location from 'expo-location';

import { supabase } from '@/lib/supabase';
import { Coordinates, RideLocation } from '@/types/rides';

type RawRideLocation = {
    id: string;
    ride_id: string;
    driver_id: string;
    latitude: number | string;
    longitude: number | string;
    heading: number | string | null;
    speed_mps: number | string | null;
    is_active: boolean;
    updated_at: string | null;
};

function mapRideLocation(row: RawRideLocation): RideLocation {
    return {
        id: row.id,
        rideId: row.ride_id,
        driverId: row.driver_id,
        latitude: Number(row.latitude),
        longitude: Number(row.longitude),
        heading:
            row.heading == null || !Number.isFinite(Number(row.heading))
                ? null
                : Number(row.heading),
        speedMps:
            row.speed_mps == null ||
            !Number.isFinite(Number(row.speed_mps))
                ? null
                : Number(row.speed_mps),
        isActive: row.is_active,
        updatedAt: row.updated_at,
    };
}

async function getAuthenticatedUserId(): Promise<string> {
    const {
        data: { user },
        error,
    } = await supabase.auth.getUser();

    if (error) {
        throw new Error(error.message);
    }

    if (!user) {
        throw new Error('You must be logged in.');
    }

    return user.id;
}

export async function requestLocationPermission(): Promise<void> {
    const { status } =
        await Location.requestForegroundPermissionsAsync();

    if (status !== Location.PermissionStatus.GRANTED) {
        throw new Error(
            'Location permission is required for live ride tracking.',
        );
    }
}

export async function getCurrentCoordinates(): Promise<Coordinates> {
    await requestLocationPermission();

    const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
    });

    return {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
    };
}

export async function publishDriverLocation(
    rideId: string,
    position: Location.LocationObject,
): Promise<RideLocation> {
    const driverId = await getAuthenticatedUserId();

    const { data, error } = await supabase
        .from('ride_locations')
        .upsert(
            {
                ride_id: rideId,
                driver_id: driverId,
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                heading:
                    position.coords.heading != null &&
                    position.coords.heading >= 0
                        ? position.coords.heading
                        : null,
                speed_mps:
                    position.coords.speed != null &&
                    position.coords.speed >= 0
                        ? position.coords.speed
                        : null,
                is_active: true,
                updated_at: new Date().toISOString(),
            },
            {
                onConflict: 'ride_id',
            },
        )
        .select('*')
        .single();

    if (error) {
        throw new Error(error.message);
    }

    return mapRideLocation(data as RawRideLocation);
}

export async function startDriverLocationPublisher(
    rideId: string,
    onPublished?: (location: RideLocation) => void,
): Promise<Location.LocationSubscription> {
    await requestLocationPermission();

    return Location.watchPositionAsync(
        {
            accuracy: Location.Accuracy.High,
            timeInterval: 5000,
            distanceInterval: 10,
        },
        async (position) => {
            try {
                const location = await publishDriverLocation(
                    rideId,
                    position,
                );
                onPublished?.(location);
            } catch (error) {
                console.error('Could not publish driver location:', error);
            }
        },
        (reason) => {
            console.error('Driver location watcher failed:', reason);
        },
    );
}

export async function stopDriverLocation(
    rideId: string,
): Promise<void> {
    const driverId = await getAuthenticatedUserId();

    const { error } = await supabase
        .from('ride_locations')
        .update({
            is_active: false,
            updated_at: new Date().toISOString(),
        })
        .eq('ride_id', rideId)
        .eq('driver_id', driverId);

    if (error) {
        throw new Error(error.message);
    }
}

export async function fetchLatestDriverLocation(
    rideId: string,
): Promise<RideLocation | null> {
    const { data, error } = await supabase
        .from('ride_locations')
        .select('*')
        .eq('ride_id', rideId)
        .maybeSingle();

    if (error) {
        throw new Error(error.message);
    }

    return data ? mapRideLocation(data as RawRideLocation) : null;
}

export function subscribeToDriverLocation(
    rideId: string,
    onLocation: (location: RideLocation) => void,
) {
    const channel = supabase
        .channel(`ride-location-${rideId}-${Date.now()}`)
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'ride_locations',
                filter: `ride_id=eq.${rideId}`,
            },
            (payload) => {
                if (payload.eventType === 'DELETE') {
                    return;
                }

                onLocation(
                    mapRideLocation(
                        payload.new as unknown as RawRideLocation,
                    ),
                );
            },
        )
        .subscribe((status, error) => {
            if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                console.error(
                    'Ride location Realtime error:',
                    status,
                    error,
                );
            }
        });

    return () => {
        void supabase.removeChannel(channel);
    };
}

export function calculateDistanceKm(
    from: Coordinates,
    to: Coordinates,
): number {
    const earthRadiusKm = 6371;
    const latitude1 = (from.latitude * Math.PI) / 180;
    const latitude2 = (to.latitude * Math.PI) / 180;
    const latitudeDifference =
        ((to.latitude - from.latitude) * Math.PI) / 180;
    const longitudeDifference =
        ((to.longitude - from.longitude) * Math.PI) / 180;

    const a =
        Math.sin(latitudeDifference / 2) ** 2 +
        Math.cos(latitude1) *
            Math.cos(latitude2) *
            Math.sin(longitudeDifference / 2) ** 2;

    const centralAngle =
        2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return earthRadiusKm * centralAngle;
}

export function calculateEtaMinutes(
    distanceKm: number,
    speedMps: number | null,
): number {
    // Use measured speed when the driver is moving.
    // Otherwise use a 40 km/h city-driving fallback for an MVP estimate.
    const speedKmh =
        speedMps != null && speedMps >= 1.5
            ? speedMps * 3.6
            : 40;

    return Math.max(1, Math.ceil((distanceKm / speedKmh) * 60));
}

export function isLocationStale(updatedAt: string | null): boolean {
    if (!updatedAt) {
        return true;
    }

    const ageMs = Date.now() - new Date(updatedAt).getTime();
    return !Number.isFinite(ageMs) || ageMs > 30_000;
}

export function hasDriverArrived(distanceKm: number): boolean {
    return distanceKm <= 0.1;
}
