import { supabase } from '@/lib/supabase';

async function getUserId() {
    const {
        data: { user },
        error,
    } = await supabase.auth.getUser();

    if (error) throw new Error(error.message);
    if (!user) throw new Error('You must be logged in.');

    return user.id;
}

async function updateMyRide(
    rideId: string,
    status: 'in_progress' | 'completed' | 'cancelled',
) {
    const userId = await getUserId();

    const { data, error } = await supabase
        .from('rides_offered')
        .update({ status })
        .eq('id', rideId)
        .eq('driver_id', userId)
        .select('*')
        .single();

    if (error) {
        throw new Error(error.message);
    }

    return data;
}

export async function startRide(rideId: string) {
    const userId = await getUserId();

    const { data: ride, error } = await supabase
        .from('rides_offered')
        .select('id, driver_id, status')
        .eq('id', rideId)
        .single();

    if (error) throw new Error(error.message);

    if (ride.driver_id !== userId) {
        throw new Error('You cannot start this ride.');
    }

    if (!['open', 'full'].includes(ride.status)) {
        throw new Error('This ride cannot be started.');
    }

    return updateMyRide(rideId, 'in_progress');
}

export async function completeRide(rideId: string) {
    const userId = await getUserId();

    const { data: ride, error } = await supabase
        .from('rides_offered')
        .select('id, driver_id, status')
        .eq('id', rideId)
        .single();

    if (error) throw new Error(error.message);

    if (ride.driver_id !== userId) {
        throw new Error('You cannot complete this ride.');
    }

    if (ride.status !== 'in_progress') {
        throw new Error('This ride has not started.');
    }

    const updatedRide = await updateMyRide(
        rideId,
        'completed',
    );

    // Accepted passengers become completed.
    await supabase
        .from('ride_requests')
        .update({ status: 'completed' })
        .eq('ride_id', rideId)
        .eq('status', 'accepted');

    // Pending passengers are no longer relevant.
    await supabase
        .from('ride_requests')
        .update({ status: 'rejected' })
        .eq('ride_id', rideId)
        .eq('status', 'pending');

    return updatedRide;
}

export async function cancelRide(rideId: string) {
    const userId = await getUserId();

    const { data: ride, error } = await supabase
        .from('rides_offered')
        .select('id, driver_id, status')
        .eq('id', rideId)
        .single();

    if (error) throw new Error(error.message);

    if (ride.driver_id !== userId) {
        throw new Error('You cannot cancel this ride.');
    }

    if (
        ride.status === 'completed' ||
        ride.status === 'cancelled'
    ) {
        throw new Error('This ride is already finished.');
    }

    const updatedRide = await updateMyRide(
        rideId,
        'cancelled',
    );

    await supabase
        .from('ride_requests')
        .update({ status: 'cancelled' })
        .eq('ride_id', rideId)
        .in('status', ['pending', 'accepted']);

    return updatedRide;
}