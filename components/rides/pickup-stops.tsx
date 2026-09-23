import { useCallback, useEffect, useState } from 'react';
import { Alert, TouchableOpacity, View } from 'react-native';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { AppText } from '@/components/text';
import { supabase } from '@/lib/supabase';
import { RoadRoute } from '@/services/ride-routing-service';
import { openGoogleMaps } from '@/services/ride-navigation-service';
import { fetchRidePassengerRequests } from '@/services/offerer-ride-requests-service';

export function PickupStops({ rideId, route, refresh }: { rideId: string; route: RoadRoute | null; refresh: (optimize?: boolean) => Promise<void> }) {
  const colors = Colors[useColorScheme() ?? 'light'];
  const [busy, setBusy] = useState(false);
  const [pickedUp, setPickedUp] = useState<Set<string>>(new Set());
  const [names, setNames] = useState<Record<string, string>>({});
  const [loadError, setLoadError] = useState('');
  const load = useCallback(async () => {
    const { data, error } = await supabase.from('ride_requests').select('id,picked_up_at').eq('ride_id', rideId).eq('status', 'accepted');
    if (error) throw new Error(error.message);
    setPickedUp(new Set((data ?? []).filter(r => r.picked_up_at).map(r => r.id)));
    const requests = await fetchRidePassengerRequests(rideId);
    setNames(Object.fromEntries(requests.map(r => [r.id, r.requesterName])));
    setLoadError('');
  }, [rideId]);
  useEffect(() => { void load().catch(() => setLoadError('Could not load pickup progress. Tap to retry.')); }, [load]);
  async function action(work: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    try { await work(); } catch (e) { Alert.alert('Could not update stops', e instanceof Error ? e.message : 'Try again.'); }
    finally { setBusy(false); }
  }
  const stops = route?.stops?.filter(s => !s.requestId || !pickedUp.has(s.requestId)) ?? [];
  const pickups = stops.filter(s => s.requestId);
  return <View style={{ gap: 14 }}>
    {stops.length > 0 && <>
      <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={() => void action(() => openGoogleMaps(stops))}
        style={{ backgroundColor: colors.tint, borderRadius: 14, padding: 16, alignItems: 'center', opacity: busy ? 0.6 : 1 }}>
        <AppText style={{ color: colors.onPrimary, fontWeight: '700' }}>{busy ? 'Updating…' : 'Open Google Maps'}</AppText>
      </TouchableOpacity>
      <AppText style={{ color: colors.icon, fontSize: 13 }}>{pickups.length
        ? 'After each pickup, return here and tap Picked up. At your destination, tap Complete ride.'
        : 'At your destination, return here and tap Complete ride.'}</AppText>
    </>}
    <AppText style={{ fontSize: 18, fontWeight: '700' }}>Your stops</AppText>
    {loadError ? <TouchableOpacity onPress={() => void action(load)}><AppText>{loadError}</AppText></TouchableOpacity> : null}
    {stops.map((s, i) => <View key={s.requestId ?? `stop-${i}`} style={{ gap: 8, paddingVertical: 8 }}>
      <AppText>{i + 1}. {s.requestId && names[s.requestId] ? `${names[s.requestId]} — ` : ''}{s.label}</AppText>
      {s.requestId && <View style={{ flexDirection: 'row', gap: 20 }}>
        <TouchableOpacity disabled={busy} onPress={() => Alert.alert('Passenger picked up?', s.label, [
          { text: 'Cancel', style: 'cancel' }, { text: 'Picked up', onPress: () => void action(async () => {
            const { error } = await supabase.rpc('mark_passenger_picked_up', { p_request_id: s.requestId });
            if (error) throw new Error(error.message);
            await load(); await refresh();
          }) },
        ])}><AppText style={{ color: '#165FD5' }}>Picked up</AppText></TouchableOpacity>
        {i > 0 && <TouchableOpacity disabled={busy} onPress={() => void action(async () => {
          const ids = pickups.map(p => p.requestId!);
          [ids[i - 1], ids[i]] = [ids[i], ids[i - 1]];
          const { error } = await supabase.rpc('set_pickup_order', { p_ride_id: rideId, p_request_ids: ids });
          if (error) throw new Error(error.message);
          await refresh();
        })}><AppText style={{ color: '#165FD5' }}>Move up</AppText></TouchableOpacity>}
      </View>}
    </View>)}
    {pickups.length > 1 && <TouchableOpacity disabled={busy} onPress={() => void action(() => refresh(true))}>
      <AppText style={{ color: '#165FD5' }}>{busy ? 'Updating…' : 'Optimize order'}</AppText>
    </TouchableOpacity>}
  </View>;
}
