import { Alert, Linking, Platform } from 'react-native';

/** Open an event address as a destination in the platform's maps app. */
export async function openEventMap(location: string | null | undefined): Promise<void> {
    const address = location?.trim();
    if (!address) {
        Alert.alert('Location unavailable', 'This event does not have a location yet.');
        return;
    }

    const destination = encodeURIComponent(address);
    const url = Platform.OS === 'ios'
        ? `https://maps.apple.com/?daddr=${destination}`
        : `https://www.google.com/maps/dir/?api=1&destination=${destination}`;

    try {
        await Linking.openURL(url);
    } catch {
        Alert.alert('Unable to open maps', 'Please check that a maps application or browser is available.');
    }
}
