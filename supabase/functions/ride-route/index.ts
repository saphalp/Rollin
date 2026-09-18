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
      .select('driver_id,status,pickup_latitude,pickup_longitude,destination_latitude,destination_longitude')
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
    const pickup = point(ride.pickup_latitude, ride.pickup_longitude);
    const destination = point(ride.destination_latitude, ride.destination_longitude);
    if (!pickup || !destination) {
      return reply({ error: 'This ride needs valid pickup and destination coordinates.' }, 422);
    }
    const coordinates = [pickup, destination];
    let includesDriver = false;
    if (ride.status === 'in_progress') {
      const { data: location } = await client.from('ride_locations')
        .select('latitude,longitude,is_active,updated_at').eq('ride_id', body.rideId).maybeSingle();
      const age = location ? Date.now() - Date.parse(location.updated_at) : Infinity;
      const driver = location && point(location.latitude, location.longitude);
      if (driver && location?.is_active && age >= 0 && age <= 30_000 &&
          (driver[0] !== pickup[0] || driver[1] !== pickup[1])) {
        coordinates.unshift(driver);
        includesDriver = true;
      }
    }
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
    const response = await fetch('https://api.openrouteservice.org/v2/directions/driving-car/geojson', {
      method: 'POST',
      headers: { Authorization: key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ coordinates, preference: 'shortest', instructions: true, language: 'en', units: 'm' }),
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
    const steps = (feature.properties.segments ?? []).flatMap((segment: { steps?: Record<string, unknown>[] }) =>
      (segment.steps ?? []).filter((step) => typeof step.instruction === 'string' && Number.isFinite(step.distance))
        .map((step) => ({ instruction: step.instruction, distanceMeters: step.distance, type: step.type })),
    );
    const route = {
      coordinates: geometry.coordinates.map(([longitude, latitude]: number[]) => ({ latitude, longitude })),
      distanceMeters: summary.distance, durationSeconds: summary.duration,
      includesDriver, calculatedAt: new Date().toISOString(),
      steps,
    };
    const { error: saveError } = await client.from('ride_routes').upsert({
      ride_id: body.rideId, route, updated_at: route.calculatedAt,
    }, { onConflict: 'ride_id' });
    if (saveError) return reply({ error: 'Could not share the route. Check the ride_routes migration and permissions.' }, 503);
    return reply(route);
  } catch {
    return reply({ error: 'Could not calculate the route. Please try again.' }, 502);
  }
});
