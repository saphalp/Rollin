import { supabase } from '@/lib/supabase';

export type OfferedRideDashboardItem = {
  id: string;
  pickupLocation: string;
  destination: string;
  dateTime: string | null;
  availableSeats: number;
  status: string;
  activityTitle: string | null;
  requestCount: number;
};

type MyRideRequestDashboardItemBase = {
  id: string;
  status: string;
  createdAt: string | null;
  pickupLocation: string;
  destination: string;
  dateTime: string | null;
};

export type MyRideRequestDashboardItem = MyRideRequestDashboardItemBase &
  (
    | { kind: 'seat'; rideId: string; offererName: string }
    | { kind: 'wanted'; wantedRequestId: string }
  );

export type RideHistoryDashboardItem = {
  id: string;
  type: 'offered' | 'requested';
  pickupLocation: string;
  destination: string;
  dateTime: string | null;
  status: string;
  counterpart: string;
};

async function getUserId(): Promise<string> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) throw new Error(error.message);
  if (!user) throw new Error('You must be logged in.');

  return user.id;
}

export async function fetchMyActiveOffers(): Promise<OfferedRideDashboardItem[]> {
  const userId = await getUserId();

  const { data: rides, error } = await supabase
    .from('rides_offered')
    .select('id, activity_id, pickup_location, destination, date_time, available_seats, status')
    .eq('driver_id', userId)
    .in('status', ['open', 'full', 'in_progress'])
    .order('date_time', { ascending: true });

  if (error) throw new Error(error.message);
  if (!rides?.length) return [];

  const rideIds = rides.map((ride) => ride.id);
  const activityIds = [...new Set(rides.map((ride) => ride.activity_id).filter(Boolean))] as string[];

  const [requestsResult, activitiesResult] = await Promise.all([
    supabase
      .from('ride_requests')
      .select('ride_id')
      .in('ride_id', rideIds)
      .in('status', ['pending', 'accepted']),
    activityIds.length
      ? supabase.from('activities').select('id, title').in('id', activityIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (requestsResult.error) throw new Error(requestsResult.error.message);
  if (activitiesResult.error) throw new Error(activitiesResult.error.message);

  const requestCounts = new Map<string, number>();
  for (const request of requestsResult.data ?? []) {
    if (!request.ride_id) continue;
    requestCounts.set(request.ride_id, (requestCounts.get(request.ride_id) ?? 0) + 1);
  }

  const activityTitles = new Map<string, string>();
  for (const activity of activitiesResult.data ?? []) {
    activityTitles.set(activity.id, activity.title);
  }

  return rides.map((ride) => ({
    id: ride.id,
    pickupLocation: ride.pickup_location,
    destination: ride.destination,
    dateTime: ride.date_time,
    availableSeats: Number(ride.available_seats ?? 0),
    status: ride.status,
    activityTitle: ride.activity_id ? activityTitles.get(ride.activity_id) ?? null : null,
    requestCount: requestCounts.get(ride.id) ?? 0,
  }));
}

export async function fetchMyActiveRequests(): Promise<MyRideRequestDashboardItem[]> {
  const userId = await getUserId();

  const [seatRequestsResult, wantedRequestsResult] = await Promise.all([
    supabase
      .from('ride_requests')
      .select('id, ride_id, driver_id, status, created_at')
      .eq('requester_id', userId)
      .in('status', ['pending', 'accepted'])
      .order('created_at', { ascending: false }),
    supabase
      .from('ride_wanted_requests')
      .select('id, pickup_location, destination, date_time, status, created_at')
      .eq('requester_id', userId)
      .eq('status', 'open')
      .order('created_at', { ascending: false }),
  ]);

  if (seatRequestsResult.error) throw new Error(seatRequestsResult.error.message);
  if (wantedRequestsResult.error) throw new Error(wantedRequestsResult.error.message);

  const requests = seatRequestsResult.data ?? [];
  const wantedRequests = wantedRequestsResult.data ?? [];

  const rideIds = [...new Set(requests.map((r) => r.ride_id).filter(Boolean))] as string[];
  const driverIds = [...new Set(requests.map((r) => r.driver_id).filter(Boolean))] as string[];

  const [ridesResult, profilesResult] = await Promise.all([
    rideIds.length
      ? supabase
        .from('rides_offered')
        .select('id, pickup_location, destination, date_time')
        .in('id', rideIds)
      : Promise.resolve({ data: [], error: null }),
    driverIds.length
      ? supabase.from('profiles').select('id, full_name').in('id', driverIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (ridesResult.error) throw new Error(ridesResult.error.message);
  if (profilesResult.error) throw new Error(profilesResult.error.message);

  const rideMap = new Map((ridesResult.data ?? []).map((ride) => [ride.id, ride]));
  const profileMap = new Map(
    (profilesResult.data ?? []).map((profile) => [
      profile.id,
      profile.full_name?.trim() || 'Rollin user'
    ]),
  );

  const seatItems: MyRideRequestDashboardItem[] = requests.flatMap((request) => {
    if (!request.ride_id) return [];
    const ride = rideMap.get(request.ride_id);
    if (!ride) return [];

    return [{
      kind: 'seat' as const,
      id: request.id,
      rideId: request.ride_id,
      status: request.status,
      createdAt: request.created_at,
      pickupLocation: ride.pickup_location,
      destination: ride.destination,
      dateTime: ride.date_time,
      offererName: request.driver_id
        ? profileMap.get(request.driver_id) ?? 'Rollin user'
        : 'Rollin user',
    }];
  });

  const wantedItems: MyRideRequestDashboardItem[] = wantedRequests.map((request) => ({
    kind: 'wanted' as const,
    id: request.id,
    wantedRequestId: request.id,
    status: request.status,
    createdAt: request.created_at,
    pickupLocation: request.pickup_location,
    destination: request.destination,
    dateTime: request.date_time,
  }));

  return [...seatItems, ...wantedItems].sort((a, b) => {
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bTime - aTime;
  });
}

export async function fetchMyRideHistory(
  filter: 'all' | 'offered' | 'requested',
): Promise<RideHistoryDashboardItem[]> {
  const userId = await getUserId();
  const result: RideHistoryDashboardItem[] = [];

  if (filter === 'all' || filter === 'offered') {
    const { data: offered, error } = await supabase
      .from('rides_offered')
      .select('id, pickup_location, destination, date_time, status')
      .eq('driver_id', userId)
      .in('status', ['completed', 'cancelled'])
      .order('date_time', { ascending: false });

    if (error) throw new Error(error.message);

    for (const ride of offered ?? []) {
      result.push({
        id: `offered-${ride.id}`,
        type: 'offered',
        pickupLocation: ride.pickup_location,
        destination: ride.destination,
        dateTime: ride.date_time,
        status: ride.status,
        counterpart: 'You offered this ride',
      });
    }
  }

  if (filter === 'all' || filter === 'requested') {
    const { data: requests, error } = await supabase
      .from('ride_requests')
      .select('id, ride_id, driver_id, status, created_at')
      .eq('requester_id', userId)
      .in('status', ['rejected', 'cancelled', 'completed'])
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);

    if (requests?.length) {
      const rideIds = [...new Set(requests.map((r) => r.ride_id).filter(Boolean))] as string[];
      const driverIds = [...new Set(requests.map((r) => r.driver_id).filter(Boolean))] as string[];

      const [ridesResult, profilesResult] = await Promise.all([
        supabase
          .from('rides_offered')
          .select('id, pickup_location, destination, date_time')
          .in('id', rideIds),
        driverIds.length
          ? supabase.from('profiles').select('id, full_name').in('id', driverIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (ridesResult.error) throw new Error(ridesResult.error.message);
      if (profilesResult.error) throw new Error(profilesResult.error.message);

      const rideMap = new Map((ridesResult.data ?? []).map((ride) => [ride.id, ride]));
      const profileMap = new Map(
        (profilesResult.data ?? []).map((profile) => [
          profile.id,
          profile.full_name?.trim() || 'Rollin user',
        ]),
      );

      for (const request of requests) {
        if (!request.ride_id) continue;
        const ride = rideMap.get(request.ride_id);
        if (!ride) continue;

        result.push({
          id: `requested-${request.id}`,
          type: 'requested',
          pickupLocation: ride.pickup_location,
          destination: ride.destination,
          dateTime: ride.date_time,
          status: request.status,
          counterpart: request.driver_id
            ? `Ride offered by ${profileMap.get(request.driver_id) ?? 'Rollin user'}`
            : 'Ride request',
        });
      }
    }

    const { data: wantedRequests, error: wantedError } = await supabase
      .from('ride_wanted_requests')
      .select('id, pickup_location, destination, date_time, status, created_at')
      .eq('requester_id', userId)
      .in('status', ['fulfilled', 'cancelled'])
      .order('created_at', { ascending: false });

    if (wantedError) throw new Error(wantedError.message);

    for (const request of wantedRequests ?? []) {
      result.push({
        id: `wanted-${request.id}`,
        type: 'requested',
        pickupLocation: request.pickup_location,
        destination: request.destination,
        dateTime: request.date_time,
        status: request.status,
        counterpart:
          request.status === 'fulfilled'
            ? 'A driver offered you a ride'
            : 'You cancelled this request',
      });
    }
  }

  return result.sort((a, b) => {
    const aTime = a.dateTime ? new Date(a.dateTime).getTime() : 0;
    const bTime = b.dateTime ? new Date(b.dateTime).getTime() : 0;
    return bTime - aTime;
  });
}

export function subscribeToRideDashboard(onChange: () => void) {
  const ridesChannel = supabase
    .channel(`dashboard-rides-${Date.now()}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'rides_offered' }, onChange)
    .subscribe();

  const requestsChannel = supabase
    .channel(`dashboard-requests-${Date.now()}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'ride_requests' }, onChange)
    .subscribe();

  const wantedRequestsChannel = supabase
    .channel(`dashboard-wanted-requests-${Date.now()}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'ride_wanted_requests' }, onChange)
    .subscribe();

  return () => {
    void supabase.removeChannel(ridesChannel);
    void supabase.removeChannel(wantedRequestsChannel);
    void supabase.removeChannel(requestsChannel);
  };
}
