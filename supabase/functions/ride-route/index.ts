import { createClient } from 'npm:@supabase/supabase-js@2.110.2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const reply = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: cors });

function point(latitude: unknown, longitude: unknown): [number, number] | null {
  if (latitude == null || longitude == null) return null;
  const lat = Number(latitude);
  const lon = Number(longitude);
  return Number.isFinite(lat) && Number.isFinite(lon) &&
      Math.abs(lat) <= 90 && Math.abs(lon) <= 180
    ? [lon, lat] : null;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return reply({ error: 'Use POST.' }, 405);

  try {
    const authorization = req.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer ')) {
      return reply({ error: 'Sign in to view a route.' }, 401);
    }
    const client = createClient(
      Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authorization } },
        auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) return reply({ error: 'Sign in again to view a route.' }, 401);

    const body = await req.json().catch(() => null);
    if (typeof body?.rideId !== 'string' ||
        !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(body.rideId)) {
      return reply({ error: 'A valid ride ID is required.' }, 400);
    }
    // Use the caller's RLS permissions, never a service-role key.
    const { data: ride, error } = await client.from('rides_offered')
      .select('driver_id,status,pickup_mode,pickup_location,pickup_latitude,pickup_longitude,destination,destination_latitude,destination_longitude')
      .eq('id', body.rideId).maybeSingle();
    if (error) return reply({ error: 'Could not load this ride.' }, 500);
    if (!ride) return reply({ error: 'Ride unavailable.' }, 404);
    if (ride.driver_id !== user.id) {
      const { data: request, error: accessError } = await client.from('ride_requests')
        .select('id').eq('ride_id', body.rideId).eq('requester_id', user.id)
        .eq('status', 'accepted').limit(1).maybeSingle();
      if (accessError || !request) return reply({ error: 'Only ride participants can view this route.' }, 403);
    }
    if (!['open', 'full', 'in_progress'].includes(ride.status)) {
      return reply({ error: 'This ride has ended.' }, 409);
    }
    if (ride.driver_id !== user.id) {
      const { data: saved, error: savedError } = await client.from('ride_routes')
        .select('route').eq('ride_id', body.rideId).maybeSingle();
      if (savedError) return reply({ error: 'Shared routes are not configured. Apply the ride_routes migration.' }, 503);
      if (!saved) return reply({ error: 'Waiting for the driver to plan the route.' }, 409);
      return reply(saved.route);
    }
    const destination = point(ride.destination_latitude, ride.destination_longitude);
    if (!destination) return reply({ error: 'This ride needs valid destination coordinates.' }, 422);
    const { data: location, error: locationError } = await client.from('ride_locations')
      .select('latitude,longitude,is_active,updated_at').eq('ride_id', body.rideId).maybeSingle();
    const age = location ? Date.now() - Date.parse(location.updated_at) : Infinity;
    const driver = location && point(location.latitude, location.longitude);
    if (locationError || !driver || !location?.is_active || age < 0 || age > 60_000) {
      return reply({ error: 'Get a fresh driver location before planning this route.' }, 422);
    }
    const { data: requests, error: requestsError } = await client.from('ride_requests')
      .select('id,pickup_address,pickup_latitude,pickup_longitude,picked_up_at,pickup_order,created_at')
      .eq('ride_id', body.rideId).eq('status', 'accepted').order('created_at');
    if (requestsError) return reply({ error: 'Could not load passenger pickups. Apply the pickups migration.' }, 503);
    const pending = (requests ?? []).filter((q: any) => !q.picked_up_at);
    const stops: { requestId: string | null; label: string; latitude: number; longitude: number; order: number | null }[] = [];
    for (const q of pending) {
      const p = point(q.pickup_latitude, q.pickup_longitude) ?? point(ride.pickup_latitude, ride.pickup_longitude);
      if (!p) return reply({ error: 'A passenger is missing pickup coordinates.' }, 422);
      stops.push({ requestId: q.id, label: q.pickup_address || ride.pickup_location || 'Passenger pickup',
        latitude: p[1], longitude: p[0], order: q.pickup_order });
    }
    // A fixed meetup still applies when driving without accepted passengers.
    if (!(requests ?? []).length && ride.pickup_mode !== 'individual') {
      const p = point(ride.pickup_latitude, ride.pickup_longitude);
      if (p) stops.push({ requestId: null, label: ride.pickup_location || 'Pickup', latitude: p[1], longitude: p[0], order: 0 });
    }
    if (stops.length > 10) return reply({ error: 'Route planning supports up to 10 passenger pickups.' }, 422);
    const includesDriver = true;
    const key = Deno.env.get('ORS_API_KEY');
    if (!key) {
      // Log only presence and deployment metadata, never secret values.
      console.error('ride-route: missing ORS secret', {
        diagnosticVersion: 'ors-config-v1',
        secretPresent: key !== undefined,
        secretNonEmpty: Boolean(key),
        deployment: Deno.env.get('DENO_DEPLOYMENT_ID') ?? 'unknown',
        region: Deno.env.get('SB_REGION') ?? 'unknown',
      });
      return reply({ error: 'Road routing has not been configured yet.' }, 503);
    }
    const manualOrder = body.optimize !== true && stops.every(s => s.order != null);
    if (manualOrder) stops.sort((a, b) => a.order! - b.order!);
    else if (stops.length > 1) {
      const matrixResponse = await fetch('https://api.openrouteservice.org/v2/matrix/driving-car', {
        method: 'POST', headers: { Authorization: key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ locations: [driver, ...stops.map(s => [s.longitude, s.latitude]), destination], metrics: ['distance'], units: 'm' }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!matrixResponse.ok) return reply({ error: matrixResponse.status === 429 ? 'Routing limit reached. Try again later.' : 'Could not calculate pickup order.' }, matrixResponse.status === 429 ? 429 : 502);
      const matrix = (await matrixResponse.json()).distances;
      const order = shortestPickupOrder(matrix, stops.length);
      const sorted = order.map(i => stops[i]);
      stops.splice(0, stops.length, ...sorted);
    }
    const coordinates = [driver, ...stops.map(s => [s.longitude, s.latitude]), destination];
    const response = await fetch('https://api.openrouteservice.org/v2/directions/driving-car/geojson', {
      method: 'POST',
      headers: { Authorization: key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ coordinates, preference: 'shortest', instructions: false, language: 'en', units: 'm' }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      if (response.status === 429) return reply({ error: 'Routing limit reached. Try again later.' }, 429);
      if ([400, 404].includes(response.status)) return reply({ error: 'No driving route was found for these locations.' }, 422);
      return reply({ error: 'Routing service unavailable. Check the server configuration or try again later.' }, 502);
    }
    const result = await response.json();
    const feature = result.features?.[0];
    const geometry = feature?.geometry;
    const summary = feature?.properties?.summary;
    if (geometry?.type !== 'LineString' || !Array.isArray(geometry.coordinates) ||
        geometry.coordinates.length < 2 ||
        !geometry.coordinates.every((p: unknown[]) => Array.isArray(p) && point(p[1], p[0])) ||
        !Number.isFinite(summary?.distance) || summary.distance < 0 ||
        !Number.isFinite(summary?.duration) || summary.duration < 0) {
      return reply({ error: 'Routing service returned an invalid route.' }, 502);
    }
    const route = {
      coordinates: geometry.coordinates.map(([longitude, latitude]: number[]) => ({ latitude, longitude })),
      distanceMeters: summary.distance, durationSeconds: summary.duration,
      includesDriver, calculatedAt: new Date().toISOString(),
      steps: [],
      stops: [...stops.map(({ order, ...s }) => s), { requestId: null, label: ride.destination, latitude: destination[1], longitude: destination[0] }],
      orderMethod: manualOrder ? 'saved' : 'road-distance',
    };
    const ids = stops.filter(s => s.requestId).map(s => s.requestId);
    if (ids.length) {
      const { error: orderError } = await client.rpc('set_pickup_order', { p_ride_id: body.rideId, p_request_ids: ids });
      if (orderError) return reply({ error: 'Passenger list changed. Refresh the route before navigating.' }, 409);
    }
    const { error: saveError } = await client.from('ride_routes').upsert({
      ride_id: body.rideId, route, updated_at: route.calculatedAt,
    }, { onConflict: 'ride_id' });
    if (saveError) return reply({ error: 'Could not share the route. Check the ride_routes migration and permissions.' }, 503);
    return reply(route);
  } catch {
    return reply({ error: 'Could not calculate the route. Please try again.' }, 502);
  }
});

// Exact minimum for the ORS road-distance matrix, with a fixed start and destination.
// Matrix distances are provider-selected road paths, not a guarantee of every shortest road path.
export function shortestPickupOrder(matrix: (number | null)[][], n: number): number[] {
  if (!Number.isInteger(n) || n < 0 || n > 10) throw new Error('Invalid pickup count');
  if (n === 0) return [];
  if (!Array.isArray(matrix) || matrix.length !== n + 2 || matrix.some(r => !Array.isArray(r) || r.length !== n + 2)) throw new Error('Invalid distance matrix');
  const distance = (a: number, b: number) => {
    const v = matrix[a][b]; return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : Infinity;
  };
  const dp = Array.from({ length: 1 << n }, () => Array(n).fill(Infinity));
  const prev = Array.from({ length: 1 << n }, () => Array(n).fill(-1));
  for (let i = 0; i < n; i++) dp[1 << i][i] = distance(0, i + 1);
  for (let mask = 1; mask < (1 << n); mask++) for (let i = 0; i < n; i++) {
    if (!(mask & (1 << i))) continue;
    for (let j = 0; j < n; j++) if (!(mask & (1 << j))) {
      const next = mask | (1 << j), cost = dp[mask][i] + distance(i + 1, j + 1);
      if (cost < dp[next][j]) { dp[next][j] = cost; prev[next][j] = i; }
    }
  }
  let mask = (1 << n) - 1, last = -1, best = Infinity;
  for (let i = 0; i < n; i++) {
    const total = dp[mask][i] + distance(i + 1, n + 1);
    if (total < best) { best = total; last = i; }
  }
  if (last < 0) throw new Error('No reachable pickup order');
  const order: number[] = [];
  while (last >= 0) { order.unshift(last); const p = prev[mask][last]; mask ^= 1 << last; last = p; }
  return order;
}
