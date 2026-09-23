import { Alert, Linking } from 'react-native';
import { Coordinates } from '@/types/rides';

export function googleMapsURL(stops: Coordinates[], wholeTrip = true): string {
  if (!stops.length) throw new Error('There are no remaining stops.');
  // Three waypoints also work in the mobile browser fallback. Longer trips open the next stop.
  const selected = wholeTrip && stops.length <= 4 ? stops : stops.slice(0, 1);
  const coordinate = (p: Coordinates) => {
    if (!Number.isFinite(p.latitude) || !Number.isFinite(p.longitude) || Math.abs(p.latitude) > 90 || Math.abs(p.longitude) > 180) throw new Error('Invalid stop coordinates.');
    return `${p.latitude},${p.longitude}`;
  };
  const destination = coordinate(selected[selected.length - 1]);
  const waypoints = selected.slice(0, -1).map(coordinate).join('|');
  return `https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=${encodeURIComponent(destination)}${waypoints ? `&waypoints=${encodeURIComponent(waypoints)}` : ''}`;
}

export async function openGoogleMaps(stops: Coordinates[], wholeTrip = true) {
  if (wholeTrip && stops.length > 4) {
    const proceed = await new Promise<boolean>(resolve => Alert.alert('Navigate one stop at a time',
      'This trip has more stops than the Google Maps browser link supports. Open the next stop, then return to Rollin after each pickup.',
      [{ text: 'Cancel', style: 'cancel', onPress: () => resolve(false) }, { text: 'Open next stop', onPress: () => resolve(true) }],
      { cancelable: true, onDismiss: () => resolve(false) }));
    if (!proceed) return;
  }
  await Linking.openURL(googleMapsURL(stops, wholeTrip));
}
