import { FunctionsHttpError } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';
import { Coordinates } from '@/types/rides';

export type RoadRoute = {
    coordinates: Coordinates[];
    distanceMeters: number;
    durationSeconds: number;
    includesDriver: boolean;
    calculatedAt: string;
    steps?: { instruction: string; distanceMeters: number; type: number }[];
};

export function formatMiles(meters: number): string {
    const miles = meters / 1609.344;
    return `${miles.toFixed(miles < 1 ? 2 : 1)} mi`;
}

export async function fetchSharedRoadRoute(rideId: string): Promise<RoadRoute | null> {
    const { data, error } = await supabase.from('ride_routes').select('route').eq('ride_id', rideId).maybeSingle();
    if (error) throw new Error('Could not load the shared route. Check your connection and shared-route setup.');
    return data?.route as RoadRoute ?? null;
}

export async function fetchRoadRoute(rideId: string): Promise<RoadRoute> {
    const { data, error } = await supabase.functions.invoke('ride-route', {
        body: { rideId },
    });
    if (error) {
        let message = 'Could not load the road route. Check your connection and try again.';
        if (error instanceof FunctionsHttpError) {
            const body = await error.context.json().catch(() => null);
            if (typeof body?.error === 'string') message = body.error;
        }
        throw new Error(message);
    }
    if (!Array.isArray(data?.coordinates) || data.coordinates.length < 2 ||
        !Number.isFinite(data.distanceMeters) || !Number.isFinite(data.durationSeconds)) {
        throw new Error('The routing service returned an invalid route.');
    }
    return data as RoadRoute;
}
