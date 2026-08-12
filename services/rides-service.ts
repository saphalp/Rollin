import { supabase } from '@/lib/supabase';
import {
    ActivitySummary,
    DriverSummary,
    RideFilter,
    RideOffer,
    RideStatus,
} from '@/types/rides';

type AvailableRideOptions = {
    activityId?: string | null;
    filter?: RideFilter;
    search?: string;
};

type RawRide = {
    id: string;
    driver_id: string;
    activity_id: string | null;
    pickup_location: string;
    pickup_latitude: number | string | null;
    pickup_longitude: number | string | null;
    destination: string;
    destination_latitude: number | string | null;
    destination_longitude: number | string | null;
    date_time: string | null;
    available_seats: number | string;
    notes: string | null;
    status: RideStatus;
    created_at: string | null;
};

function toNullableNumber(value: number | string | null): number | null {
    if (value == null) {
        return null;
    }

    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : null;
}

function mapDriver(profile: Record<string, unknown> | undefined, id: string): DriverSummary {
    const fullName =
        typeof profile?.full_name === 'string' ? profile.full_name : null;
    const username =
        typeof profile?.username === 'string' ? profile.username : null;
    const avatarUrl =
        typeof profile?.avatar_url === 'string'
            ? profile.avatar_url
            : typeof profile?.profile_image_url === 'string'
                ? profile.profile_image_url
                : null;

    return {
        id,
        name: fullName || username || 'Rollin driver',
        username,
        avatarUrl,
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

async function hydrateRides(rawRides: RawRide[]): Promise<RideOffer[]> {
    if (rawRides.length === 0) {
        return [];
    }

    const driverIds = [...new Set(rawRides.map((ride) => ride.driver_id))];
    const activityIds = [
        ...new Set(
            rawRides
                .map((ride) => ride.activity_id)
                .filter((id): id is string => Boolean(id)),
        ),
    ];

    const [profilesResult, activitiesResult] = await Promise.all([
        supabase.from('profiles').select('*').in('id', driverIds),
        activityIds.length > 0
            ? supabase.from('activities').select('*').in('id', activityIds)
            : Promise.resolve({ data: [], error: null }),
    ]);

    if (profilesResult.error) {
        console.warn(
            'Ride profiles could not be loaded:',
            profilesResult.error.message,
        );
    }

    if (activitiesResult.error) {
        console.warn(
            'Ride activities could not be loaded:',
            activitiesResult.error.message,
        );
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

    return rawRides.map((ride) => ({
        id: ride.id,
        driverId: ride.driver_id,
        activityId: ride.activity_id,

        pickupLocation: ride.pickup_location,
        pickupLatitude: toNullableNumber(ride.pickup_latitude),
        pickupLongitude: toNullableNumber(ride.pickup_longitude),

        destination: ride.destination,
        destinationLatitude: toNullableNumber(ride.destination_latitude),
        destinationLongitude: toNullableNumber(
            ride.destination_longitude,
        ),

        dateTime: ride.date_time,
        availableSeats: Number(ride.available_seats ?? 0),
        notes: ride.notes,
        status: ride.status,
        createdAt: ride.created_at,

        driver: mapDriver(
            profileMap.get(ride.driver_id),
            ride.driver_id,
        ),
        activity: ride.activity_id
            ? mapActivity(
                activityMap.get(ride.activity_id),
                ride.activity_id,
            )
            : null,
    }));
}

export async function fetchAvailableRides(
    options: AvailableRideOptions = {},
): Promise<RideOffer[]> {
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

    const { activityId, filter = 'all', search = '' } = options;

    let query = supabase
        .from('rides_offered')
        .select('*')
        .eq('status', 'open')
        .gt('available_seats', 0)
        .neq('driver_id', user.id)
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

    let rides = await hydrateRides(data ?? []);

    const normalizedSearch = search.trim().toLowerCase();

    if (normalizedSearch) {
        rides = rides.filter((ride) =>
            [
                ride.pickupLocation,
                ride.destination,
                ride.driver.name,
                ride.activity?.title ?? '',
            ]
                .join(' ')
                .toLowerCase()
                .includes(normalizedSearch),
        );
    }

    return rides;
}

export async function fetchRideById(
    rideId: string,
): Promise<RideOffer | null> {
    if (!rideId) {
        throw new Error('Ride ID is required.');
    }

    const { data, error } = await supabase
        .from('rides_offered')
        .select('*')
        .eq('id', rideId)
        .maybeSingle();

    if (error) {
        throw new Error(error.message);
    }

    if (!data) {
        return null;
    }

    const [ride] = await hydrateRides([data as RawRide]);
    return ride ?? null;
}

export function subscribeToRideOffers(onChange: () => void) {
    const channel = supabase
        .channel(`rides-offered-${Date.now()}`)
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'rides_offered',
            },
            onChange,
        )
        .subscribe((status, error) => {
            if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                console.error('Ride Realtime error:', status, error);
            }
        });

    return () => {
        void supabase.removeChannel(channel);
    };
}
