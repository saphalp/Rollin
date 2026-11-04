const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const ts = require('typescript');

function compile(path, dependencies) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, require: name => {
    if (!(name in dependencies)) throw Error(name);
    return dependencies[name];
  }, console });
  return exports;
}

const rideStatus = compile('lib/ride-status.ts', {});
const HOUR = 60 * 60 * 1000;
const at = offsetMs => new Date(Date.now() + offsetMs).toISOString();

function dashboardService(supabase) {
  return compile('services/ride-dashboard-service.ts', {
    '@/lib/supabase': { supabase, isTransientRealtimeError: () => false },
    '@/lib/ride-status': rideStatus,
    '@/lib/profile/resolve-avatar-uri': { resolveAvatarUri: path => (path ? `avatars/${path}` : 'fallback') },
  });
}

// Minimal Supabase stand-in: each table returns fixed rows and records the filters used.
function fakeSupabase(tables, calls) {
  return {
    auth: { getUser: async () => ({ data: { user: { id: 'driver' } }, error: null }) },
    from(table) {
      const query = {
        then(resolve) { resolve({ data: tables[table] ?? [], error: null }); },
        maybeSingle: async () => ({ data: (tables[table] ?? [])[0] ?? null, error: null }),
      };
      for (const method of ['select', 'eq', 'in', 'order', 'gt', 'gte', 'neq', 'not', 'is']) {
        query[method] = (...args) => { calls.push([table, method, ...args]); return query; };
      }
      return query;
    },
  };
}

test('incoming seat requests list pending requests on your rides with their activity', async () => {
  const calls = [];
  const supabase = fakeSupabase({
    ride_requests: [
      { id: 'q1', ride_id: 'r1', requester_id: 'pat', pickup_address: 'Library', created_at: null },
      { id: 'q2', ride_id: 'r2', requester_id: 'oli', pickup_address: null, created_at: null },
      { id: 'q3', ride_id: 'gone', requester_id: 'oli', pickup_address: null, created_at: null },
    ],
    rides_offered: [
      { id: 'r1', activity_id: 'a1', pickup_location: 'Union', destination: 'Stadium', date_time: '2030-01-01T10:00:00Z' },
      { id: 'r2', activity_id: null, pickup_location: 'Dorm', destination: 'Airport', date_time: null },
    ],
    profiles: [{ id: 'pat', full_name: ' Pat Lee ', profile_picture: 'pat.jpg' }, { id: 'oli', full_name: '', profile_picture: null }],
    activities: [{ id: 'a1', title: 'Game night' }],
  }, calls);
  const { fetchIncomingSeatRequests } = dashboardService(supabase);

  const items = JSON.parse(JSON.stringify(await fetchIncomingSeatRequests()));

  assert.ok(calls.some(c => c[0] === 'ride_requests' && c[1] === 'eq' && c[2] === 'driver_id' && c[3] === 'driver'));
  assert.ok(calls.some(c => c[0] === 'ride_requests' && c[1] === 'eq' && c[2] === 'status' && c[3] === 'pending'));
  assert.deepEqual(items, [
    {
      id: 'q1', rideId: 'r1', requesterName: 'Pat Lee', requesterAvatarUrl: 'avatars/pat.jpg', pickupLocation: 'Library',
      destination: 'Stadium', dateTime: '2030-01-01T10:00:00Z', activityTitle: 'Game night',
    },
    {
      id: 'q2', rideId: 'r2', requesterName: 'Rollin user', requesterAvatarUrl: 'fallback', pickupLocation: 'Dorm',
      destination: 'Airport', dateTime: null, activityTitle: null,
    },
  ], 'falls back to the ride pickup, skips requests whose ride is gone, and has no title for independent rides');
});

test('your active requests carry the activity title, or none for independent rides', async () => {
  const supabase = fakeSupabase({
    ride_requests: [{ id: 'q1', ride_id: 'r1', driver_id: 'dana', status: 'accepted', created_at: '2030-01-02T00:00:00Z' }],
    ride_wanted_requests: [{ id: 'w1', activity_id: null, pickup_location: 'Gym', destination: 'Mall', date_time: null, status: 'open', created_at: '2030-01-01T00:00:00Z' }],
    rides_offered: [{ id: 'r1', activity_id: 'a1', pickup_location: 'Union', destination: 'Stadium', date_time: null }],
    profiles: [{ id: 'dana', full_name: 'Dana' }],
    activities: [{ id: 'a1', title: 'Game night' }],
  }, []);
  const { fetchMyActiveRequests } = dashboardService(supabase);

  const items = JSON.parse(JSON.stringify(await fetchMyActiveRequests()));
  assert.deepEqual(items.map(item => [item.kind, item.activityTitle]), [['seat', 'Game night'], ['wanted', null]]);
});

test('a ride that never started expires after the grace period; in-progress rides never expire', () => {
  const { isRideExpired, isRideClosed, closedRideStatus, isWantedRequestExpired, RIDE_START_GRACE_MS } = rideStatus;
  assert.equal(RIDE_START_GRACE_MS, 30 * 60 * 1000);
  assert.equal(isRideExpired({ status: 'open', dateTime: at(-10 * 60 * 1000) }), false, 'a driver 10 minutes late can still start');
  assert.equal(isRideExpired({ status: 'full', dateTime: at(-31 * 60 * 1000) }), true);
  assert.equal(isRideExpired({ status: 'in_progress', dateTime: at(-5 * HOUR) }), false);
  assert.equal(isRideClosed({ status: 'cancelled', dateTime: at(HOUR) }), true);
  assert.equal(isRideClosed({ status: 'open', dateTime: null }), false);
  assert.equal(closedRideStatus({ status: 'open', dateTime: at(-HOUR) }), 'expired');
  assert.equal(closedRideStatus({ status: 'completed', dateTime: at(-HOUR) }), 'completed');
  assert.equal(isWantedRequestExpired(at(-60 * 1000)), true);
  assert.equal(isWantedRequestExpired(at(60 * 1000)), false);
});

test('closed rides leave Offering and Requests and show up in History instead', async () => {
  const supabase = fakeSupabase({
    rides_offered: [
      // Mine
      { id: 'mine-open', driver_id: 'driver', activity_id: null, pickup_location: 'A', destination: 'B', date_time: at(HOUR), available_seats: 2, status: 'open' },
      { id: 'mine-expired', driver_id: 'driver', activity_id: null, pickup_location: 'A', destination: 'C', date_time: at(-2 * HOUR), available_seats: 2, status: 'open' },
      { id: 'mine-driving', driver_id: 'driver', activity_id: null, pickup_location: 'A', destination: 'D', date_time: at(-2 * HOUR), available_seats: 1, status: 'in_progress' },
      { id: 'mine-cancelled', driver_id: 'driver', activity_id: null, pickup_location: 'A', destination: 'E', date_time: at(HOUR), available_seats: 2, status: 'cancelled' },
      // Others' rides I asked for a seat on
      { id: 'theirs-cancelled', driver_id: 'dana', activity_id: null, pickup_location: 'X', destination: 'Y', date_time: at(HOUR), status: 'cancelled' },
      { id: 'theirs-open', driver_id: 'dana', activity_id: null, pickup_location: 'X', destination: 'Z', date_time: at(HOUR), status: 'open' },
    ],
    ride_requests: [
      { id: 'seat-on-cancelled', ride_id: 'theirs-cancelled', driver_id: 'dana', requester_id: 'driver', status: 'accepted', created_at: null, pickup_address: null },
      { id: 'seat-on-open', ride_id: 'theirs-open', driver_id: 'dana', requester_id: 'driver', status: 'pending', created_at: null, pickup_address: null },
    ],
    ride_wanted_requests: [
      { id: 'wanted-future', activity_id: null, pickup_location: 'P', destination: 'Q', date_time: at(HOUR), status: 'open', created_at: null, offered_ride_id: null },
      { id: 'wanted-past', activity_id: null, pickup_location: 'P', destination: 'R', date_time: at(-HOUR), status: 'open', created_at: null, offered_ride_id: null },
    ],
    profiles: [{ id: 'dana', full_name: 'Dana' }],
    activities: [],
  }, []);
  const { fetchMyActiveOffers, fetchMyActiveRequests, fetchMyRideHistory } = dashboardService(supabase);

  // The fake ignores server filters, so drop the rows those filters would exclude.
  const offers = JSON.parse(JSON.stringify(await fetchMyActiveOffers()))
    .filter(ride => ride.status !== 'cancelled');
  assert.deepEqual(offers.map(ride => ride.id).sort(), ['mine-driving', 'mine-open', 'theirs-open']);

  const active = JSON.parse(JSON.stringify(await fetchMyActiveRequests()));
  assert.deepEqual(active.map(item => item.id).sort(), ['seat-on-open', 'wanted-future']);

  const history = JSON.parse(JSON.stringify(await fetchMyRideHistory('all')));
  const statuses = Object.fromEntries(history.map(item => [item.id, item.status]));
  assert.equal(statuses['offered-mine-expired'], 'expired');
  assert.equal(statuses['offered-mine-cancelled'], 'cancelled');
  assert.equal(statuses['offered-mine-open'], undefined, 'an upcoming ride is not history');
  assert.equal(statuses['offered-mine-driving'], undefined, 'an in-progress ride is not history');
  assert.equal(statuses['requested-seat-on-cancelled'], 'cancelled');
  assert.equal(statuses['requested-seat-on-open'], undefined);
  assert.equal(statuses['wanted-wanted-past'], 'expired');
  assert.equal(statuses['wanted-wanted-future'], undefined);
});

test('seat requests on closed rides are not shown to the driver', async () => {
  const supabase = fakeSupabase({
    ride_requests: [
      { id: 'q-live', ride_id: 'live', requester_id: 'pat', pickup_address: null, created_at: null },
      { id: 'q-expired', ride_id: 'expired', requester_id: 'pat', pickup_address: null, created_at: null },
    ],
    rides_offered: [
      { id: 'live', activity_id: null, pickup_location: 'A', destination: 'B', date_time: at(HOUR), status: 'open' },
      { id: 'expired', activity_id: null, pickup_location: 'A', destination: 'C', date_time: at(-HOUR), status: 'open' },
    ],
    profiles: [{ id: 'pat', full_name: 'Pat' }],
    activities: [],
  }, []);
  const { fetchIncomingSeatRequests } = dashboardService(supabase);
  assert.deepEqual((await fetchIncomingSeatRequests()).map(item => item.id), ['q-live']);
});

test('ride requests show the requester\'s name and only ask for profile columns that exist', async () => {
  const calls = [];
  const supabase = fakeSupabase({
    ride_wanted_requests: [{ id: 'w1', requester_id: 'pat', activity_id: null, pickup_location: 'Library', destination: 'Airport', date_time: null, notes: null, status: 'open', created_at: null }],
    profiles: [{ id: 'pat', full_name: 'Pat Lee', profile_picture: null }],
  }, calls);
  const { fetchWantedRequest } = compile('services/ride-wanted-requests-service.ts', {
    '@/lib/supabase': { supabase },
    '@/lib/profile/resolve-avatar-uri': { resolveAvatarUri: () => null },
  });

  const request = await fetchWantedRequest('w1');
  assert.equal(request.requester.name, 'Pat Lee');
  const profileSelect = calls.find(c => c[0] === 'profiles' && c[1] === 'select');
  assert.ok(!profileSelect[2].includes('username'), 'profiles has no username column');
});

test('ride offers carry the driver\'s profile picture, or none when they have no photo', async () => {
  const supabase = fakeSupabase({
    rides_offered: [
      { id: 'r1', driver_id: 'dana', activity_id: null, pickup_location: 'A', destination: 'B', date_time: null, available_seats: 2, status: 'open' },
      { id: 'r2', driver_id: 'sam', activity_id: null, pickup_location: 'A', destination: 'C', date_time: null, available_seats: 1, status: 'open' },
    ],
    profiles: [{ id: 'dana', full_name: 'Dana', profile_picture: 'dana.jpg' }, { id: 'sam', full_name: 'Sam', profile_picture: null }],
  }, []);
  const { fetchAvailableRides } = compile('services/rides-service.ts', {
    '@/lib/supabase': { supabase, isTransientRealtimeError: () => false },
    '@/lib/profile/resolve-avatar-uri': { resolveAvatarUri: path => `avatars/${path}` },
  });

  const rides = await fetchAvailableRides();
  assert.deepEqual(rides.map(ride => [ride.driver.name, ride.driver.avatarUrl]), [['Dana', 'avatars/dana.jpg'], ['Sam', null]]);
});
