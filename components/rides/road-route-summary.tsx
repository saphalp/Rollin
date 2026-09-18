import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, TouchableOpacity, View } from 'react-native';

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
        <View style={{ gap: 8 }}>
            <TouchableOpacity
                accessibilityRole="button"
                disabled={loading}
                onPress={() => void load()}
                style={{ padding: 14, borderRadius: 12, backgroundColor: '#165FD5', alignItems: 'center' }}
            >
                {loading ? <ActivityIndicator color="#fff" /> : (
                    <AppText style={{ color: '#fff', fontWeight: '700' }}>
                        {isDriver ? (route ? 'Refresh road route' : 'Load road route') : 'Refresh driver’s route'}
                    </AppText>
                )}
            </TouchableOpacity>
            {error ? <AppText accessibilityRole="alert">{error}</AppText> : null}
            {route ? (
                <>
                    <AppText>
                        {route.includesDriver ? 'Driver → pickup → destination' : 'Pickup → destination'}
                    </AppText>
                    <AppText>
                        {formatMiles(route.distanceMeters)} · approximately {Math.max(1, Math.ceil(route.durationSeconds / 60))} min total
                    </AppText>
                    <AppText style={{ fontSize: 12 }}>
                        Estimated driving time without live traffic. {isDriver ? 'Refresh to recalculate the route.' : 'Following the driver’s shared route.'}
                    </AppText>
                    <AppText
                        accessibilityRole="link"
                        style={{ fontSize: 12, textDecorationLine: 'underline' }}
                        onPress={() => void Linking.openURL('https://openrouteservice.org').catch(() => {})}
                    >
                        Routing © openrouteservice | Map data © OpenStreetMap contributors
                    </AppText>
                </>
            ) : !loading ? <AppText>{isDriver ? 'Load a route or tap Start Drive.' : 'Waiting for the driver to plan the route.'}</AppText> : null}
        </View>
    );
}
