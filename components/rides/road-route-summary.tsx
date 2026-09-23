import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, TouchableOpacity, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { AppText } from '@/components/text';
import { fetchRoadRoute, fetchSharedRoadRoute, formatMiles, RoadRoute } from '@/services/ride-routing-service';
import { supabase } from '@/lib/supabase';

type Props = {
    rideId: string;
    isDriver: boolean;
    route: RoadRoute | null;
    onRoute: (route: RoadRoute | null) => void;
};

export function RoadRouteSummary({ rideId, isDriver, route, onRoute }: Props) {
    const colors = Colors[useColorScheme() ?? 'light'];
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const busy = useRef(false);
    const mounted = useRef(true);
    const lastAttempt = useRef(0);

    useEffect(() => {
        let active = true;
        let generation = 0;
        mounted.current = true;
        async function sync() {
            const current = ++generation;
            try {
                const saved = await fetchSharedRoadRoute(rideId);
                if (active && current === generation) { onRoute(saved); setError(null); }
            } catch (e) {
                if (active && current === generation) setError(e instanceof Error ? e.message : 'Route unavailable.');
            }
        }
        const channel = supabase.channel(`shared-route-${rideId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'ride_routes', filter: `ride_id=eq.${rideId}` }, () => void sync())
            .subscribe((status) => { if (status === 'SUBSCRIBED') void sync(); });
        void sync();
        const timer = setInterval(() => void sync(), 15_000);
        return () => { active = false; mounted.current = false; clearInterval(timer); void supabase.removeChannel(channel); };
    }, [rideId, onRoute]);

    async function load() {
        if (busy.current) return;
        if (Date.now() - lastAttempt.current < 10_000) {
            setError('Please wait a few seconds before refreshing the route.');
            return;
        }
        busy.current = true;
        lastAttempt.current = Date.now();
        setLoading(true);
        setError(null);
        try {
            const result = isDriver ? await fetchRoadRoute(rideId) : await fetchSharedRoadRoute(rideId);
            if (mounted.current) {
                onRoute(result);
            }
        } catch (error) {
            if (mounted.current) setError(error instanceof Error ? error.message : 'Route unavailable.');
        } finally {
            busy.current = false;
            if (mounted.current) setLoading(false);
        }
    }

    return (
        <View style={{ gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <AppText style={{ fontWeight: '700', flex: 1 }}>{route
                    ? formatMiles(route.distanceMeters) + ' · ~' + Math.max(1, Math.ceil(route.durationSeconds / 60)) + ' min'
                    : isDriver ? 'Route overview' : 'Waiting for driver’s route'}</AppText>
                <TouchableOpacity accessibilityRole="button" disabled={loading} onPress={() => void load()} style={{ padding: 10 }}>
                    {loading ? <ActivityIndicator color={colors.tint} /> : <AppText style={{ color: colors.tint }}>{route ? 'Refresh' : 'Load route'}</AppText>}
                </TouchableOpacity>
            </View>
            {error ? <AppText accessibilityRole="alert">{error}</AppText> : null}
            {route ? <AppText accessibilityRole="link" style={{ fontSize: 10, color: colors.icon }}
                onPress={() => void Linking.openURL('https://openrouteservice.org').catch(() => {})}>
                © openrouteservice · © OpenStreetMap contributors
            </AppText> : null}
        </View>
    );
}
