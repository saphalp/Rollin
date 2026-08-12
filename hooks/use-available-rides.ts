import { useCallback, useEffect, useState } from 'react';

import {
    fetchAvailableRides,
    subscribeToRideOffers,
} from '@/services/rides-service';
import { RideFilter, RideOffer } from '@/types/rides';

type Options = {
    activityId?: string | null;
    filter: RideFilter;
    search: string;
};

export function useAvailableRides({
    activityId,
    filter,
    search,
}: Options) {
    const [rides, setRides] = useState<RideOffer[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(
        null,
    );

    const load = useCallback(async () => {
        setErrorMessage(null);

        try {
            const result = await fetchAvailableRides({
                activityId,
                filter,
                search,
            });
            setRides(result);
        } catch (error) {
            setRides([]);
            setErrorMessage(
                error instanceof Error
                    ? error.message
                    : 'Could not load rides.',
            );
        }
    }, [activityId, filter, search]);

    useEffect(() => {
        let active = true;

        load().finally(() => {
            if (active) {
                setLoading(false);
            }
        });

        const unsubscribe = subscribeToRideOffers(() => {
            void load();
        });

        return () => {
            active = false;
            unsubscribe();
        };
    }, [load]);

    const refresh = useCallback(async () => {
        setRefreshing(true);

        try {
            await load();
        } finally {
            setRefreshing(false);
        }
    }, [load]);

    return {
        rides,
        loading,
        refreshing,
        errorMessage,
        refresh,
    };
}
