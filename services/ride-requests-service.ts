import { supabase } from '@/lib/supabase';
import { RideOffer, RideRequest, RideRequestStatus } from '@/types/rides';

type RawRideRequest = {
    id: string;
    ride_id: string | null;
    activity_id: string | null;
    requester_id: string | null;
    driver_id: string | null;
    status: RideRequestStatus;
    created_at: string | null;
    updated_at: string | null;
};

function mapRideRequest(row: RawRideRequest): RideRequest {
    if (!row.ride_id || !row.requester_id || !row.driver_id) {
        throw new Error('This ride request is missing a required connection.');
    }

    return {
        id: row.id,
        rideId: row.ride_id,
        activityId: row.activity_id,
        requesterId: row.requester_id,
        driverId: row.driver_id,
        status: row.status,
        createdAt: row.created_at,
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

export async function fetchMyRideRequest(
    rideId: string,
): Promise<RideRequest | null> {
    const userId = await getAuthenticatedUserId();

    const { data, error } = await supabase
        .from('ride_requests')
        .select('*')
        .eq('ride_id', rideId)
        .eq('requester_id', userId)
        .in('status', ['pending', 'accepted'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) {
        throw new Error(error.message);
    }

    return data ? mapRideRequest(data as RawRideRequest) : null;
}

export async function createRideRequest(
    ride: RideOffer,
): Promise<RideRequest> {
    const userId = await getAuthenticatedUserId();

    if (ride.driverId === userId) {
        throw new Error('You cannot request your own ride.');
    }

    if (ride.status !== 'open') {
        throw new Error('This ride is no longer open.');
    }

    if (ride.availableSeats < 1) {
        throw new Error('This ride has no available seats.');
    }

    if (ride.dateTime && new Date(ride.dateTime).getTime() <= Date.now()) {
        throw new Error('This ride has already departed.');
    }

    const existingRequest = await fetchMyRideRequest(ride.id);

    if (existingRequest) {
        throw new Error(
            existingRequest.status === 'accepted'
                ? 'You already have an accepted seat.'
                : 'Your request is already pending.',
        );
    }

    const { data, error } = await supabase
        .from('ride_requests')
        .insert({
            ride_id: ride.id,
            activity_id: ride.activityId,
            requester_id: userId,
            driver_id: ride.driverId,
            status: 'pending',
        })
        .select('*')
        .single();

    if (error) {
        if (error.code === '23505') {
            throw new Error('You already requested this ride.');
        }

        throw new Error(error.message);
    }

    return mapRideRequest(data as RawRideRequest);
}

export async function cancelRideRequest(
    requestId: string,
): Promise<RideRequest> {
    const userId = await getAuthenticatedUserId();

    const { data, error } = await supabase
        .from('ride_requests')
        .update({
            status: 'cancelled',
        })
        .eq('id', requestId)
        .eq('requester_id', userId)
        .select('*')
        .single();

    if (error) {
        throw new Error(error.message);
    }

    return mapRideRequest(data as RawRideRequest);
}

export async function canAccessRideTracking(
    rideId: string,
    driverId: string,
): Promise<boolean> {
    const userId = await getAuthenticatedUserId();

    if (userId === driverId) {
        return true;
    }

    const { data, error } = await supabase
        .from('ride_requests')
        .select('id')
        .eq('ride_id', rideId)
        .eq('requester_id', userId)
        .eq('status', 'accepted')
        .maybeSingle();

    if (error) {
        throw new Error(error.message);
    }

    return Boolean(data);
}

export function subscribeToMyRideRequest(
    rideId: string,
    onChange: () => void,
) {
    const channel = supabase
        .channel(`ride-request-${rideId}-${Date.now()}`)
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'ride_requests',
                filter: `ride_id=eq.${rideId}`,
            },
            onChange,
        )
        .subscribe((status, error) => {
            if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                console.error(
                    'Ride request Realtime error:',
                    status,
                    error,
                );
            }
        });

    return () => {
        void supabase.removeChannel(channel);
    };
}
