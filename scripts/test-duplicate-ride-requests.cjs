const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const ts = require('typescript');

test('useNotificationRealtime drops duplicate notification payloads delivered within 15 seconds', () => {
  const code = ts.transpileModule(fs.readFileSync('hooks/use-notification-realtime.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;

  let listenerCallback;
  const channel = {
    on(_event, _filter, callback) {
      listenerCallback = callback;
      return this;
    },
    subscribe() { return this; },
  };

  const effects = [];
  const calls = [];
  const exports = {};

  vm.runInNewContext(code, {
    exports,
    require(name) {
      if (name === 'react') return {
        useRef: (val) => ({ current: val }),
        useEffect: (fn) => effects.push(fn),
      };
      if (name === '@/lib/supabase') return {
        supabase: {
          channel: () => channel,
          removeChannel: () => {},
        },
      };
      if (name === './use-auth-context') return {
        useAuthContext: () => ({ claims: { sub: 'user-123' } }),
      };
      throw new Error(`Unexpected import: ${name}`);
    },
  });

  exports.useNotificationRealtime((payload) => {
    calls.push(payload);
  });

  // Run effects
  effects.forEach(fn => fn());

  assert.ok(listenerCallback, 'Realtime listener should be registered');

  const samplePayload = {
    new: {
      id: 'notif-1',
      user_id: 'user-123',
      actor_id: 'actor-456',
      type: 'ride_request',
      message: 'Someone requested a ride',
      is_read: false,
      created_at: new Date().toISOString(),
    },
  };

  // First delivery should call callback
  listenerCallback(samplePayload);
  assert.equal(calls.length, 1);

  // Immediate second delivery of same notification ID should be deduplicated
  listenerCallback(samplePayload);
  assert.equal(calls.length, 1, 'Duplicate realtime event should be dropped');

  // Third delivery of same ID should also be dropped
  listenerCallback(samplePayload);
  assert.equal(calls.length, 1);

  // Different notification ID should be accepted
  listenerCallback({
    new: {
      ...samplePayload.new,
      id: 'notif-2',
    },
  });
  assert.equal(calls.length, 2, 'Distinct notification ID should be processed');
});

test('createRideRequest locks in-flight calls to prevent concurrent duplicate requests', async () => {
  const code = ts.transpileModule(fs.readFileSync('services/ride-requests-service.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;

  let insertCount = 0;
  let selectCount = 0;

  const exports = {};
  vm.runInNewContext(code, {
    exports,
    require(name) {
      if (name === '@/services/geocoding-service') return { geocodeAddress: async () => null };
      if (name === '@/lib/supabase') return {
        supabase: {
          auth: {
            getUser: async () => ({ data: { user: { id: 'passenger-1' } }, error: null }),
          },
          from(table) {
            assert.equal(table, 'ride_requests');
            return {
              select() {
                return {
                  eq() { return this; },
                  in() { return this; },
                  order() { return this; },
                  limit() { return this; },
                  async maybeSingle() {
                    selectCount++;
                    await new Promise(r => setTimeout(r, 20));
                    return { data: null, error: null };
                  },
                  single: async () => {
                    insertCount++;
                    await new Promise(r => setTimeout(r, 20));
                    return {
                      data: {
                        id: 'req-1',
                        ride_id: 'ride-1',
                        activity_id: null,
                        requester_id: 'passenger-1',
                        driver_id: 'driver-1',
                        status: 'pending',
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                      },
                      error: null,
                    };
                  },
                };
              },
              insert() {
                return this;
              },
            };
          },
        },
      };
      throw new Error(`Unexpected import: ${name}`);
    },
  });

  const ride = {
    id: 'ride-1',
    driverId: 'driver-1',
    status: 'open',
    availableSeats: 3,
    pickupMode: 'fixed',
  };

  // Launch two concurrent requests for the same ride
  const [res1, res2] = await Promise.all([
    exports.createRideRequest(ride),
    exports.createRideRequest(ride),
  ]);

  assert.equal(res1.id, 'req-1');
  assert.equal(res2.id, 'req-1');
  assert.equal(insertCount, 1, 'Only one insert operation should occur for concurrent seat requests');
});

