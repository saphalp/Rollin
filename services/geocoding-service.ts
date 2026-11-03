
import { supabase } from '@/lib/supabase';

export type GeocodedLocation = {
    latitude: number;
    longitude: number;
};

export async function geocodeAddress(
    address: string,
): Promise<GeocodedLocation> {
    const cleanedAddress = address.trim();

    if (!cleanedAddress) {
        throw new Error('Enter a location first.');
    }

    const { data, error } = await supabase.functions.invoke(
        'geocode-address',
        {
            body: { address: cleanedAddress },
        },
    );

    if (error) {
        throw new Error('Could not search for this address.');
    }

    if (data?.error) {
        throw new Error(data.error);
    }

    const latitude = data?.latitude;
    const longitude = data?.longitude;

    if (
        typeof latitude !== 'number' ||
        typeof longitude !== 'number' ||
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude)
    ) {
        throw new Error('Could not find valid coordinates.');
    }

    return { latitude, longitude };
}
