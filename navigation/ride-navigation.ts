import { router } from 'expo-router';

export function openRegularRideSearch() {
    router.push({
        pathname: '/ride/available',
        params: {
            rideType: 'regular',
        },
    });
}

export function openActivityRideSearch(activityId: string) {
    router.push({
        pathname: '/ride/available',
        params: {
            activityId,
            rideType: 'activity',
        },
    });
}

export function openAllRideSearch() {
    router.push('/ride/available');
}

export function openRideDetails(rideId: string) {
    router.push({
        pathname: '/ride/[id]',
        params: {
            id: rideId,
        },
    });
}

export function openRideTracking(rideId: string) {
    router.push({
        pathname: '/ride/tracking/[id]',
        params: {
            id: rideId,
        },
    });
}
