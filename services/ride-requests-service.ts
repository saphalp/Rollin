import { supabase } from '@/lib/supabase';
import {
    RideOffer,
    RideRequest,
    RideRequestStatus,
} from '@/types/rides';

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

function mapRideRequest(
    row: RawRideRequest,
): RideRequest {
    if (
        !row.ride_id ||
        !row.requester_id ||
        !row.driver_id
    ) {
        throw new Error(
            'This ride request is missing a required connection.',
        );
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

/**
 * Returns the current user's active request
 * for one specific ride.
 *
 * Active = pending or accepted.
 */
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
        .order('created_at', {
            ascending: false,
        })
        .limit(1)
        .maybeSingle();

    if (error) {
        throw new Error(error.message);
    }

    return data
        ? mapRideRequest(data as RawRideRequest)
        : null;
}

/**
 * Returns the current user's active ride request
 * for an activity.
 *
 * This prevents the same passenger from requesting
 * multiple rides for the same event/activity.
 */
export async function fetchMyActivityRideRequest(
    activityId: string,
): Promise<RideRequest | null> {
    const userId = await getAuthenticatedUserId();

    const { data, error } = await supabase
        .from('ride_requests')
        .select('*')
        .eq('activity_id', activityId)
        .eq('requester_id', userId)
        .in('status', ['pending', 'accepted'])
        .order('created_at', {
            ascending: false,
        })
        .limit(1)
        .maybeSingle();

    if (error) {
        throw new Error(error.message);
    }

    return data
        ? mapRideRequest(data as RawRideRequest)
        : null;
}

/**
 * Creates a seat request.
 *
 * Rules:
 *
 * 1. User cannot request their own ride.
 * 2. Ride must still be open.
 * 3. Ride must have seats.
 * 4. Ride must not have departed.
 * 5. User cannot request the same ride twice.
 * 6. For activity rides, a user may have only one
 *    active request for that activity.
 */
export async function createRideRequest(
    ride: RideOffer,
): Promise<RideRequest> {
    const userId = await getAuthenticatedUserId();

    /*
     * Never allow someone to request
     * their own offered ride.
     */
    if (ride.driverId === userId) {
        throw new Error(
            'You cannot request your own ride.',
        );
    }

    /*
     * Ride must still be accepting passengers.
     */
    if (ride.status !== 'open') {
        throw new Error(
            'This ride is no longer available.',
        );
    }

    /*
     * Ride must have at least one seat.
     */
    if (ride.availableSeats < 1) {
        throw new Error(
            'This ride has no available seats.',
        );
    }

    /*
     * Prevent requesting rides that have
     * already departed.
     */
    if (
        ride.dateTime &&
        new Date(ride.dateTime).getTime() <= Date.now()
    ) {
        throw new Error(
            'This ride has already departed.',
        );
    }

    /*
     * First check whether this user already
     * requested this exact ride.
     */
    const existingRideRequest =
        await fetchMyRideRequest(ride.id);

    if (existingRideRequest) {
        if (
            existingRideRequest.status === 'accepted'
        ) {
            throw new Error(
                'You already have an accepted seat on this ride.',
            );
        }

        throw new Error(
            'Your request for this ride is already pending.',
        );
    }

    /*
     * ACTIVITY RIDE RULE
     *
     * One passenger can have only one
     * pending/accepted ride request for the
     * same activity.
     */
    if (ride.activityId) {
        const existingActivityRequest =
            await fetchMyActivityRideRequest(
                ride.activityId,
            );

        if (existingActivityRequest) {
            /*
             * This should normally already have
             * been caught by fetchMyRideRequest(),
             * but keep this check for safety.
             */
            if (
                existingActivityRequest.rideId ===
                ride.id
            ) {
                if (
                    existingActivityRequest.status ===
                    'accepted'
                ) {
                    throw new Error(
                        'You already have an accepted seat on this ride.',
                    );
                }

                throw new Error(
                    'Your request for this ride is already pending.',
                );
            }

            /*
             * User requested another ride for
             * this same activity.
             */
            if (
                existingActivityRequest.status ===
                'accepted'
            ) {
                throw new Error(
                    'You already have an accepted ride for this activity.',
                );
            }

            throw new Error(
                'You already have a pending ride request for this activity. Cancel that request before choosing another ride.',
            );
        }
    }

    /*
     * Create the request.
     *
     * activity_id ALWAYS comes from the
     * selected ride itself.
     */
    const { data, error } = await supabase
        .from('ride_requests')
        .insert({
            ride_id: ride.id,
            activity_id: ride.activityId ?? null,
            requester_id: userId,
            driver_id: ride.driverId,
            status: 'pending',
        })
        .select('*')
        .single();

    if (error) {
        /*
         * PostgreSQL unique constraint violation.
         *
         * Database rules should also prevent:
         * - duplicate request for the same ride
         * - multiple active requests for one activity
         */
        if (error.code === '23505') {
            if (ride.activityId) {
                throw new Error(
                    'You already have an active ride request for this activity.',
                );
            }

            throw new Error(
                'You already requested this ride.',
            );
        }

        throw new Error(error.message);
    }

    return mapRideRequest(
        data as RawRideRequest,
    );
}

/**
 * Passenger cancels their own request.
 *
 * Once cancelled, they can request
 * another ride for the same activity.
 */
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
        .in('status', ['pending', 'accepted'])
        .select('*')
        .single();

    if (error) {
        throw new Error(error.message);
    }

    return mapRideRequest(
        data as RawRideRequest,
    );
}

/**
 * Returns whether the currently logged-in
 * user can access live tracking.
 *
 * Allowed:
 * - person offering the ride
 * - accepted passenger
 */
export async function canAccessRideTracking(
    rideId: string,
    driverId: string,
): Promise<boolean> {
    const userId = await getAuthenticatedUserId();

    /*
     * The person offering the ride
     * always has access.
     */
    if (userId === driverId) {
        return true;
    }

    /*
     * Passenger must have been accepted.
     */
    const { data, error } = await supabase
        .from('ride_requests')
        .select('id')
        .eq('ride_id', rideId)
        .eq('requester_id', userId)
        .eq('status', 'accepted')
        .limit(1)
        .maybeSingle();

    if (error) {
        throw new Error(error.message);
    }

    return Boolean(data);
}

/**
 * Subscribe to changes for requests
 * belonging to one ride.
 *
 * Examples:
 * pending -> accepted
 * pending -> rejected
 * accepted -> cancelled
 */
export function subscribeToMyRideRequest(
    rideId: string,
    onChange: () => void,
) {
    const channel = supabase
        .channel(
            `ride-request-${rideId}-${Date.now()}`,
        )
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'ride_requests',
                filter: `ride_id=eq.${rideId}`,
            },
            () => {
                onChange();
            },
        )
        .subscribe((status, error) => {
            if (
                status === 'CHANNEL_ERROR' ||
                status === 'TIMED_OUT'
            ) {
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