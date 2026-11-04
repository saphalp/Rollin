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

// Minimal Supabase stand-in: each table returns fixed rows and records the filters used.
function fakeSupabase(tables, calls) {
  return {
    auth: { getUser: async () => ({ data: { user: { id: 'driver' } }, error: null }) },
    from(table) {
      const query = {
        then(resolve) { resolve({ data: tables[table] ?? [], error: null }); },
      };
      for (const method of ['select', 'eq', 'in', 'order']) {
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
    profiles: [{ id: 'pat', full_name: ' Pat Lee ' }, { id: 'oli', full_name: '' }],
    activities: [{ id: 'a1', title: 'Game night' }],
  }, calls);
  const { fetchIncomingSeatRequests } = compile('services/ride-dashboard-service.ts', {
    '@/lib/supabase': { supabase, isTransientRealtimeError: () => false },
  });

  const items = JSON.parse(JSON.stringify(await fetchIncomingSeatRequests()));

  assert.ok(calls.some(c => c[0] === 'ride_requests' && c[1] === 'eq' && c[2] === 'driver_id' && c[3] === 'driver'));
  assert.ok(calls.some(c => c[0] === 'ride_requests' && c[1] === 'eq' && c[2] === 'status' && c[3] === 'pending'));
  assert.deepEqual(items, [
    {
      id: 'q1', rideId: 'r1', requesterName: 'Pat Lee', pickupLocation: 'Library',
      destination: 'Stadium', dateTime: '2030-01-01T10:00:00Z', activityTitle: 'Game night',
    },
    {
      id: 'q2', rideId: 'r2', requesterName: 'Rollin user', pickupLocation: 'Dorm',
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
  const { fetchMyActiveRequests } = compile('services/ride-dashboard-service.ts', {
    '@/lib/supabase': { supabase, isTransientRealtimeError: () => false },
  });

  const items = JSON.parse(JSON.stringify(await fetchMyActiveRequests()));
  assert.deepEqual(items.map(item => [item.kind, item.activityTitle]), [['seat', 'Game night'], ['wanted', null]]);
});
