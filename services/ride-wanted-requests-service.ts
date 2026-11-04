import { isTransientRealtimeError, supabase } from '@/lib/supabase';
import { resolveAvatarUri } from '@/lib/profile/resolve-avatar-uri';
import {
    ActivitySummary,
    Coordinates,
    DriverSummary,
    RideFilter,
    WantedRide,
} from '@/types/rides';

type WantedRideOptions = {
    activityId?: string | null;
    filter?: RideFilter;
};

type RawWantedRide = {
    id: string;
    requester_id: string;
    activity_id: string | null;
    pickup_location: string;
    destination: string;
    date_time: string | null;
    notes: string | null;
    status: 'open' | 'fulfilled' | 'cancelled';
    created_at: string | null;
};

function mapRequester(profile: Record<string, unknown> | undefined, id: string): DriverSummary {
    const fullName =
        typeof profile?.full_name === 'string' ? profile.full_name : null;
    const username =
        typeof profile?.username === 'string' ? profile.username : null;
    const profilePicture =
        typeof profile?.profile_picture === 'string' ? profile.profile_picture : null;

    return {
        id,
        name: fullName || username || 'Rollin rider',
        username,
        avatarUrl: resolveAvatarUri(profilePicture),
    };
}

function mapActivity(
    activity: Record<string, unknown> | undefined,
    id: string,
): ActivitySummary {
    return {
        id,
        title:
            typeof activity?.title === 'string'
                ? activity.title
                : 'Activity ride',
        location:
            typeof activity?.location === 'string'
                ? activity.location
                : null,
        dateTime:
            typeof activity?.date_time === 'string'
                ? activity.date_time
                : null,
    };
}

async function hydrateWantedRides(rawRequests: RawWantedRide[]): Promise<WantedRide[]> {
    if (rawRequests.length === 0) {
        return [];
    }

    const requesterIds = [...new Set(rawRequests.map((r) => r.requester_id))];
    const activityIds = [
        ...new Set(
            rawRequests
                .map((r) => r.activity_id)
                .filter((id): id is string => Boolean(id)),
        ),
    ];

    // profiles has no username column; asking for one fails the whole query.
    const [profilesResult, activitiesResult] = await Promise.all([
        supabase.from('profiles').select('id, full_name, profile_picture').in('id', requesterIds),
        activityIds.length > 0
            ? supabase.from('activities').select('id, title, location, date_time').in('id', activityIds)
            : Promise.resolve({ data: [], error: null }),
    ]);

    if (profilesResult.error) {
        throw new Error(profilesResult.error.message);
    }

    if (activitiesResult.error) {
        throw new Error(activitiesResult.error.message);
    }

    const profileMap = new Map<string, Record<string, unknown>>();
    for (const profile of profilesResult.data ?? []) {
        if (typeof profile.id === 'string') {
            profileMap.set(profile.id, profile);
        }
    }

    const activityMap = new Map<string, Record<string, unknown>>();
    for (const activity of activitiesResult.data ?? []) {
        if (typeof activity.id === 'string') {
            activityMap.set(activity.id, activity);
        }
    }

    return rawRequests.map((request) => ({
        id: request.id,
        requesterId: request.requester_id,
        activityId: request.activity_id,

        pickupLocation: request.pickup_location,
        destination: request.destination,
        dateTime: request.date_time,
        notes: request.notes,
        status: request.status,
        createdAt: request.created_at,

        requester: mapRequester(profileMap.get(request.requester_id), request.requester_id),
        activity: request.activity_id
            ? mapActivity(activityMap.get(request.activity_id), request.activity_id)
            : null,
    }));
}

export async function fetchWantedRides(
    options: WantedRideOptions = {},
): Promise<WantedRide[]> {
    const { activityId, filter = 'all' } = options;

    let query = supabase
        .from('ride_wanted_requests')
        .select('*')
        .eq('status', 'open')
        .gte('date_time', new Date().toISOString())
        .order('date_time', { ascending: true });

    if (activityId) {
        query = query.eq('activity_id', activityId);
    } else if (filter === 'activity') {
        query = query.not('activity_id', 'is', null);
    } else if (filter === 'regular') {
        query = query.is('activity_id', null);
    }

    const { data, error } = await query;

    if (error) {
        throw new Error(error.message);
    }

    return hydrateWantedRides((data ?? []) as RawWantedRide[]);
}

export async function createWantedRequest(input: {
    activityId?: string | null;
    pickupLocation: string;
    destination: string;
    dateTime: string;
    notes?: string | null;
}): Promise<WantedRide> {
    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
        throw new Error(authError.message);
    }

    if (!user) {
        throw new Error('You must be logged in.');
    }

    const { data, error } = await supabase
        .from('ride_wanted_requests')
        .insert({
            requester_id: user.id,
            activity_id: input.activityId ?? null,
            pickup_location: input.pickupLocation,
            destination: input.destination,
            date_time: input.dateTime,
            notes: input.notes ?? null,
            status: 'open',
        })
        .select('*')
        .single();

    if (error) {
        throw new Error(error.message);
    }

    const [request] = await hydrateWantedRides([data as RawWantedRide]);
    return request;
}

export async function cancelWantedRequest(requestId: string): Promise<void> {
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        throw new Error('You must be logged in.');
    }

    const { error } = await supabase
        .from('ride_wanted_requests')
        .update({ status: 'cancelled' })
        .eq('id', requestId)
        .eq('requester_id', user.id);

    if (error) {
        throw new Error(error.message);
    }
}

export async function fetchWantedRequest(requestId: string): Promise<WantedRide | null> {
    const { data, error } = await supabase
        .from('ride_wanted_requests')
        .select('*')
        .eq('id', requestId)
        .maybeSingle();

    if (error) {
        throw new Error(error.message);
    }

    if (!data) {
        return null;
    }

    const [request] = await hydrateWantedRides([data as RawWantedRide]);
    return request;
}

/**
 * A driver takes on a passenger's request. The database creates the ride with the request's
 * pickup, destination and time, adds the passenger as an accepted rider, and marks the
 * request fulfilled, all in one transaction. Returns the new ride's id.
 */
export async function offerRideForWantedRequest(input: {
    requestId: string;
    availableSeats: number;
    notes: string | null;
    pickup: Coordinates;
    destination: Coordinates;
}): Promise<string> {
    const { data, error } = await supabase.rpc('offer_ride_for_wanted_request', {
        p_wanted_request_id: input.requestId,
        p_available_seats: input.availableSeats,
        p_notes: input.notes,
        p_pickup_latitude: input.pickup.latitude,
        p_pickup_longitude: input.pickup.longitude,
        p_destination_latitude: input.destination.latitude,
        p_destination_longitude: input.destination.longitude,
    });

    if (error) {
        throw new Error(error.message);
    }

    return data as string;
}

export function subscribeToWantedRides(onChange: () => void) {
    const channel = supabase
        .channel(`ride-wanted-requests-${Date.now()}`)
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'ride_wanted_requests',
            },
            onChange,
        )
        .subscribe((status, error) => {
            if (status === 'SUBSCRIBED') {
                onChange();
                return;
            }
            if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                if (isTransientRealtimeError(error)) {
                    console.warn(
                        'Ride wanted requests realtime disconnected, will reconnect:',
                        error instanceof Error ? error.message : error
                    );
                } else {
                    console.error('Ride wanted requests realtime error:', status, error);
                }
            }
        });

    return () => {
        void supabase.removeChannel(channel);
    };
}
