import { useCallback, useEffect, useState } from 'react';

import {
    fetchWantedRides,
    subscribeToWantedRides,
} from '@/services/ride-wanted-requests-service';
import { RideFilter, WantedRide } from '@/types/rides';

type Options = {
    activityId?: string | null;
    filter: RideFilter;
};

export function useRideWantedRequests({ activityId, filter }: Options) {
    const [requests, setRequests] = useState<WantedRide[]>([]);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        try {
            const result = await fetchWantedRides({ activityId, filter });
            setRequests(result);
        } catch (error) {
            console.error('[useRideWantedRequests] failed:', error);
            setRequests([]);
        }
    }, [activityId, filter]);

    useEffect(() => {
        let active = true;

        setLoading(true);
        load().finally(() => {
            if (active) {
                setLoading(false);
            }
        });

        const unsubscribe = subscribeToWantedRides(() => {
            void load();
        });

        return () => {
            active = false;
            unsubscribe();
        };
    }, [load]);

    const refresh = useCallback(async () => {
        await load();
    }, [load]);

    return {
        requests,
        loading,
        refresh,
    };
}
