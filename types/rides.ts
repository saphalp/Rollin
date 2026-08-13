export type RideStatus =
    | 'open'
    | 'full'
    | 'cancelled'
    | 'in_progress'
    | 'completed';

export type RideRequestStatus =
    | 'pending'
    | 'accepted'
    | 'rejected'
    | 'cancelled'
    | 'completed';

export type RideFilter = 'all' | 'activity' | 'regular';

export type WantedRideStatus = 'open' | 'fulfilled' | 'cancelled';

export type Coordinates = {
    latitude: number;
    longitude: number;
};

export type DriverSummary = {
    id: string;
    name: string;
    username: string | null;
    avatarUrl: string | null;
};

export type ActivitySummary = {
    id: string;
    title: string;
    location: string | null;
    dateTime: string | null;
};

export type RideOffer = {
    id: string;
    driverId: string;
    activityId: string | null;

    pickupLocation: string;
    pickupLatitude: number | null;
    pickupLongitude: number | null;

    destination: string;
    destinationLatitude: number | null;
    destinationLongitude: number | null;

    dateTime: string | null;
    availableSeats: number;
    notes: string | null;
    status: RideStatus;
    createdAt: string | null;

    driver: DriverSummary;
    activity: ActivitySummary | null;
};

export type WantedRide = {
    id: string;
    requesterId: string;
    activityId: string | null;

    pickupLocation: string;
    destination: string;
    dateTime: string | null;
    notes: string | null;
    status: WantedRideStatus;
    createdAt: string | null;

    requester: DriverSummary;
    activity: ActivitySummary | null;
};

export type RideRequest = {
    id: string;
    rideId: string;
    activityId: string | null;
    requesterId: string;
    driverId: string;
    status: RideRequestStatus;
    createdAt: string | null;
    updatedAt: string | null;
};

export type RideLocation = {
    id: string;
    rideId: string;
    driverId: string;
    latitude: number;
    longitude: number;
    heading: number | null;
    speedMps: number | null;
    isActive: boolean;
    updatedAt: string | null;
};
