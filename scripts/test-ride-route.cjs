// Offline handler checks: no real credentials, network, or Deno installation needed.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const ts = require('typescript');
const source = fs.readFileSync('supabase/functions/ride-route/index.ts', 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function setup(options = {}) {
  let handler;
  const calls = [];
  const savedRoutes = [];
  const ride = { driver_id: 'driver', status: 'in_progress', pickup_latitude: 32.5,
    pickup_longitude: -92.6, destination_latitude: 32.6, destination_longitude: -92.7,
    ...options.ride };
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: options.user ?? 'driver' } } }) },
    from: (table) => {
      const query = {
        select: () => query, eq: () => query, limit: () => query,
        upsert: async (value) => { savedRoutes.push(value); return { error: options.saveError ? new Error('save failed') : null }; },
        maybeSingle: async () => ({ data: table === 'rides_offered' ? ride :
          table === 'ride_requests' ? (options.accepted ? { id: 'request' } : null) :
          table === 'ride_routes' ? (options.savedRoute ? { route: options.savedRoute } : null) :
          options.location ?? null }),
      };
      return query;
    },
  };
  vm.runInNewContext(compiled, {
    exports: {}, require: () => ({ createClient: () => client }),
    Response, Request, AbortSignal,
    Deno: { env: { get: (key) => key === 'ORS_API_KEY' && options.noKey ? undefined : 'test-value' },
      serve: (fn) => { handler = fn; } },
    fetch: async (_url, request) => {
      calls.push(JSON.parse(request.body));
      if (options.status) return new Response('', { status: options.status });
      return Response.json({ features: [{ geometry: { type: 'LineString',
        coordinates: [[-92.6, 32.5], [-92.7, 32.6]] },
        properties: { summary: { distance: 1234, duration: 200 },
          segments: [{ steps: [{ instruction: 'Turn left onto Tech Drive', distance: 200, type: 0 }] }] } }] });
    },
  });
  return { calls, savedRoutes, run: (authorized = true) => handler(new Request('https://example.test', {
    method: 'POST', headers: authorized ? { Authorization: 'Bearer test' } : {},
    body: JSON.stringify({ rideId: '12345678-1234-1234-1234-123456789abc' }),
  })) };
}

test('converts database lat/lon to ORS lon/lat and returns map coordinates', async () => {
  const app = setup();
  const response = await app.run();
  assert.equal(response.status, 200);
  assert.deepEqual(app.calls[0].coordinates, [[-92.6, 32.5], [-92.7, 32.6]]);
  assert.equal(app.calls[0].preference, 'shortest');
  const body = await response.json();
  assert.deepEqual(body.coordinates[0], { latitude: 32.5, longitude: -92.6 });
  assert.equal(body.includesDriver, false);
  assert.equal(app.calls[0].instructions, true);
  assert.equal(body.steps[0].instruction, 'Turn left onto Tech Drive');
  assert.equal(app.savedRoutes.length, 1);
  assert.equal(app.savedRoutes[0].route.distanceMeters, body.distanceMeters);
});
test('rejects unauthenticated and unrelated callers before using ORS quota', async () => {
  const app = setup({ user: 'stranger' });
  assert.equal((await app.run(false)).status, 401);
  assert.equal((await app.run()).status, 403);
  assert.equal(app.calls.length, 0);
});
test('passenger receives the saved driver route without calling ORS or overwriting it', async () => {
  const savedRoute = { coordinates: [{ latitude: 32, longitude: -92 }], distanceMeters: 100 };
  const app = setup({ user: 'passenger', accepted: true, savedRoute });
  const response = await app.run();
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), savedRoute);
  assert.equal(app.calls.length, 0);
  assert.equal(app.savedRoutes.length, 0);
});
test('passenger waits until driver has saved a route', async () => {
  const app = setup({ user: 'passenger', accepted: true });
  assert.equal((await app.run()).status, 409);
  assert.equal(app.calls.length, 0);
});
test('does not claim a route is shared when saving fails', async () => {
  assert.equal((await setup({ saveError: true }).run()).status, 503);
});
test('rejects missing coordinates, ended rides, and unconfigured keys', async () => {
  for (const [options, status] of [
    [{ ride: { pickup_latitude: null } }, 422],
    [{ ride: { status: 'completed' } }, 409], [{ noKey: true }, 503],
  ]) {
    const app = setup(options);
    assert.equal((await app.run()).status, status);
    assert.equal(app.calls.length, 0);
  }
});
test('uses only fresh active driver coordinates', async () => {
  for (const [age, active, expected] of [[0, true, 3], [60_000, true, 2], [0, false, 2]]) {
    const app = setup({ location: { latitude: 32.4, longitude: -92.5,
      updated_at: new Date(Date.now() - age).toISOString(), is_active: active } });
    assert.equal((await app.run()).status, 200);
    assert.equal(app.calls[0].coordinates.length, expected);
  }
});
test('returns actionable quota and no-route errors', async () => {
  assert.equal((await setup({ status: 429 }).run()).status, 429);
  assert.equal((await setup({ status: 404 }).run()).status, 422);
});
