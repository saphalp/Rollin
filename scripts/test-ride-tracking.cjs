const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const ts = require('typescript');

function load() {
  let statusCallback;
  let locationCallback;
  let removed = false;
  const channel = {
    on(_event, filter, callback) {
      assert.equal(filter.filter, 'ride_id=eq.ride-1');
      locationCallback = callback;
      return this;
    },
    subscribe(callback) { statusCallback = callback; return this; },
  };
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync('services/ride-tracking-service.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, {
    exports,
    require(name) {
      if (name === 'expo-location') return {};
      if (name === '@/lib/supabase') return { supabase: {
        channel: () => channel,
        removeChannel: async (value) => { assert.equal(value, channel); removed = true; },
      } };
      throw new Error(`Unexpected import: ${name}`);
    },
    console: { error() { throw new Error('Connection failures must reach the UI, not LogBox'); } },
  });
  return { service: exports, status: (value) => statusCallback(value),
    location: (value) => locationCallback(value), removed: () => removed };
}

test('location subscription reports disconnect and recovery and still delivers positions', () => {
  const harness = load();
  const states = [];
  const positions = [];
  const unsubscribe = harness.service.subscribeToDriverLocation('ride-1', value => positions.push(value), value => states.push(value));
  for (const status of ['SUBSCRIBED', 'CHANNEL_ERROR', 'TIMED_OUT', 'SUBSCRIBED']) harness.status(status);
  assert.deepEqual(states, [true, false, false, true]);
  harness.location({ eventType: 'UPDATE', new: { ride_id: 'ride-1', latitude: '32.5', longitude: '-92.6', is_active: true } });
  assert.equal(positions[0].latitude, 32.5);
  unsubscribe();
  assert.equal(harness.removed(), true);
});

test('stationary driver locations become stale as time passes', () => {
  const { service } = load();
  const updatedAt = '2026-09-18T15:00:00Z';
  const start = Date.parse(updatedAt);
  assert.equal(service.isLocationStale(updatedAt, start + 10_000), false);
  assert.equal(service.isLocationStale(updatedAt, start + 31_000), true);
  assert.equal(service.isLocationStale(null, start), true);
});
