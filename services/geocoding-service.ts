import * as Location from 'expo-location';

export type GeocodedLocation = {
    latitude: number;
    longitude: number;
};

async function ensureLocationPermission(): Promise<void> {
    const currentPermission =
        await Location.getForegroundPermissionsAsync();

    if (currentPermission.granted) {
        return;
    }

    const requestedPermission =
        await Location.requestForegroundPermissionsAsync();

    if (!requestedPermission.granted) {
        throw new Error(
            'Location permission is required to find map coordinates.',
        );
    }
}

export async function geocodeAddress(
    address: string,
): Promise<GeocodedLocation> {
    const cleanedAddress = address.trim();

    if (!cleanedAddress) {
        throw new Error('Enter a location first.');
    }

    await ensureLocationPermission();

    const results = await Location.geocodeAsync(cleanedAddress);

    if (results.length === 0) {
        throw new Error(
            `Could not find coordinates for "${cleanedAddress}".`,
        );
    }

    const firstResult = results[0];

    if (
        !Number.isFinite(firstResult.latitude) ||
        !Number.isFinite(firstResult.longitude)
    ) {
        throw new Error('The returned coordinates were invalid.');
    }

    return {
        latitude: firstResult.latitude,
        longitude: firstResult.longitude,
    };
}