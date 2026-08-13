import { supabase } from '@/lib/supabase';
import { resolveAvatarUri } from '@/lib/profile/resolve-avatar-uri';
import {
    ActivitySummary,
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

    const [profilesResult, activitiesResult] = await Promise.all([
        supabase.from('profiles').select('id, full_name, username, profile_picture').in('id', requesterIds),
        activityIds.length > 0
            ? supabase.from('activities').select('id, title, location, date_time').in('id', activityIds)
            : Promise.resolve({ data: [], error: null }),
    ]);

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

export async function fulfillWantedRequest(requestId: string): Promise<void> {
    const { error } = await supabase
        .from('ride_wanted_requests')
        .update({ status: 'fulfilled' })
        .eq('id', requestId)
        .eq('status', 'open');

    if (error) {
        throw new Error(error.message);
    }
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
            if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                console.error('Ride wanted requests realtime error:', status, error);
            }
        });

    return () => {
        void supabase.removeChannel(channel);
    };
}
