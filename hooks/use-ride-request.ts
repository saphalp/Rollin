import { useCallback, useEffect, useState } from 'react';

import {
    cancelRideRequest,
    createRideRequest,
    fetchMyRideRequest,
    subscribeToMyRideRequest,
} from '@/services/ride-requests-service';
import { RideOffer, RideRequest } from '@/types/rides';

export function useRideRequest(ride: RideOffer | null) {
    const [request, setRequest] = useState<RideRequest | null>(null);
    const [loading, setLoading] = useState(Boolean(ride));
    const [submitting, setSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(
        null,
    );

    const loadRequest = useCallback(async () => {
        if (!ride) {
            setRequest(null);
            setLoading(false);
            return;
        }

        setErrorMessage(null);

        try {
            setRequest(await fetchMyRideRequest(ride.id));
        } catch (error) {
            setErrorMessage(
                error instanceof Error
                    ? error.message
                    : 'Could not load request status.',
            );
        } finally {
            setLoading(false);
        }
    }, [ride]);

    useEffect(() => {
        void loadRequest();

        if (!ride) {
            return;
        }

        const unsubscribe = subscribeToMyRideRequest(
            ride.id,
            loadRequest,
        );

        return unsubscribe;
    }, [loadRequest, ride]);

    const requestSeat = useCallback(async () => {
        if (!ride) {
            return;
        }

        setSubmitting(true);
        setErrorMessage(null);

        try {
            const created = await createRideRequest(ride);
            setRequest(created);
        } catch (error) {
            setErrorMessage(
                error instanceof Error
                    ? error.message
                    : 'Could not request the seat.',
            );
            throw error;
        } finally {
            setSubmitting(false);
        }
    }, [ride]);

    const cancelSeatRequest = useCallback(async () => {
        if (!request) {
            return;
        }

        setSubmitting(true);
        setErrorMessage(null);

        try {
            await cancelRideRequest(request.id);
            setRequest(null);
        } catch (error) {
            setErrorMessage(
                error instanceof Error
                    ? error.message
                    : 'Could not cancel the request.',
            );
            throw error;
        } finally {
            setSubmitting(false);
        }
    }, [request]);

    return {
        request,
        loading,
        submitting,
        errorMessage,
        requestSeat,
        cancelSeatRequest,
        refresh: loadRequest,
    };
}
