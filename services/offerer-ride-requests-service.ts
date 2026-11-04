import { resolveAvatarUri } from '@/lib/profile/resolve-avatar-uri';
import { supabase } from '@/lib/supabase';

export type OffererPassengerRequest = {
    id: string;
    rideId: string;
    requesterId: string;
    requesterName: string;
    pickupAddress: string | null;
    status: 'pending' | 'accepted' | 'rejected' | 'cancelled' | 'completed';
    createdAt: string | null;
};

/** An accepted passenger on a ride the driver is driving, for the pickup cards. */
export type RidePassenger = {
    requestId: string;
    name: string;
    avatarUrl: string;
    pickupAddress: string | null;
    pickedUpAt: string | null;
    pickupOrder: number | null;
    createdAt: string | null;
};

async function getUserId() {
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

export async function isCurrentUserRideOfferer(
    driverId: string,
): Promise<boolean> {
    const userId = await getUserId();
    return userId === driverId;
}

export async function fetchRidePassengerRequests(
    rideId: string,
): Promise<OffererPassengerRequest[]> {
    const userId = await getUserId();

    const { data: ride, error: rideError } =
        await supabase
            .from('rides_offered')
            .select('id, driver_id')
            .eq('id', rideId)
            .eq('driver_id', userId)
            .single();

    if (rideError || !ride) {
        throw new Error(
            'You do not have permission to manage this ride.',
        );
    }

    const { data: requests, error } =
        await supabase
            .from('ride_requests')
            .select(
                `
        id,
        ride_id,
        requester_id,
        status,
        created_at,
        pickup_address
        `,
            )
            .eq('ride_id', rideId)
            .in('status', ['pending', 'accepted'])
            .order('created_at', {
                ascending: true,
            });

    if (error) {
        throw new Error(error.message);
    }

    if (!requests?.length) {
        return [];
    }

    const requesterIds = [
        ...new Set(
            requests
                .map((request) => request.requester_id)
                .filter(
                    (id): id is string =>
                        Boolean(id),
                ),
        ),
    ];

    const { data: profiles, error: profilesError } =
        await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', requesterIds);

    if (profilesError) {
        throw new Error(
            profilesError.message,
        );
    }

    const profileMap = new Map(
        (profiles ?? []).map((profile) => [
            profile.id,
            profile.full_name?.trim() || 'Rollin user',
        ]),
    );

    return requests.flatMap((request) => {
        if (
            !request.ride_id ||
            !request.requester_id
        ) {
            return [];
        }

        return [
            {
                id: request.id,
                rideId: request.ride_id,
                requesterId:
                    request.requester_id,
                requesterName:
                    profileMap.get(
                        request.requester_id,
                    ) ?? 'Rollin user',
                pickupAddress: request.pickup_address,
                status: request.status,
                createdAt:
                    request.created_at,
            } as OffererPassengerRequest,
        ];
    });
}

export async function acceptPassengerRequest(
    requestId: string,
) {
    const { data, error } =
        await supabase.rpc(
            'accept_ride_request',
            {
                p_request_id: requestId,
            },
        );

    if (error) {
        throw new Error(error.message);
    }

    return data;
}

export async function declinePassengerRequest(
    requestId: string,
) {
    const userId = await getUserId();

    const { data: request, error: requestError } =
        await supabase
            .from('ride_requests')
            .select(
                'id, ride_id, driver_id, status',
            )
            .eq('id', requestId)
            .single();

    if (requestError || !request) {
        throw new Error(
            'Ride request could not be found.',
        );
    }

    if (request.driver_id !== userId) {
        throw new Error(
            'You cannot manage this request.',
        );
    }

    if (request.status !== 'pending') {
        throw new Error(
            'Only pending requests can be declined.',
        );
    }

    const { error } = await supabase
        .from('ride_requests')
        .update({
            status: 'rejected',
        })
        .eq('id', requestId)
        .eq('driver_id', userId)
        .eq('status', 'pending');

    if (error) {
        throw new Error(error.message);
    }
}

export function subscribeToRidePassengerRequests(
    rideId: string,
    onChange: () => void,
) {
    const channel = supabase
        .channel(
            `offerer-requests-${rideId}`,
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
        .subscribe();

    return () => {
        void supabase.removeChannel(channel);
    };
}
export async function fetchRidePassengers(rideId: string): Promise<RidePassenger[]> {
    const { data: requests, error } = await supabase
        .from('ride_requests')
        .select('id, requester_id, pickup_address, picked_up_at, pickup_order, created_at')
        .eq('ride_id', rideId)
        .eq('status', 'accepted');

    if (error) {
        throw new Error(error.message);
    }

    if (!requests?.length) {
        return [];
    }

    const requesterIds = [...new Set(requests.map((r) => r.requester_id).filter(Boolean))] as string[];
    const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, profile_picture')
        .in('id', requesterIds);

    if (profilesError) {
        throw new Error(profilesError.message);
    }

    const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile]));

    return requests.map((request) => {
        const profile = request.requester_id ? profileMap.get(request.requester_id) : undefined;

        return {
            requestId: request.id,
            name: profile?.full_name?.trim() || 'Rollin user',
            avatarUrl: resolveAvatarUri(profile?.profile_picture),
            pickupAddress: request.pickup_address,
            pickedUpAt: request.picked_up_at,
            pickupOrder: request.pickup_order,
            createdAt: request.created_at,
        };
    });
}

export async function markPassengerPickedUp(requestId: string): Promise<void> {
    const { error } = await supabase.rpc('mark_passenger_picked_up', { p_request_id: requestId });

    if (error) {
        throw new Error(error.message);
    }
}

export async function setPickupOrder(rideId: string, requestIds: string[]): Promise<void> {
    const { error } = await supabase.rpc('set_pickup_order', { p_ride_id: rideId, p_request_ids: requestIds });

    if (error) {
        throw new Error(error.message);
    }
}
