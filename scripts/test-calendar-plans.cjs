const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const ts = require('typescript');
process.env.TZ = 'America/Chicago';

function load(file, mocks = {}, globals = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(code, { exports, Date, Set, Map, Error, AbortController, ...globals, require: name => {
    if (!(name in mocks)) throw Error(`Missing mock: ${name}`);
    return mocks[name];
  } });
  return exports;
}
const api = load('lib/calendar-plans.ts');
const activity = (id, host_id = 'me', date_time = '2026-10-24T18:00:00Z', status = 'active') => ({ id, title: id, host_id, date_time, status, location: 'Campus', formatted_address: null });
const ride = (id, driver_id = 'me', status = 'open', date_time = '2026-10-24T17:00:00Z') => ({ id, driver_id, status, date_time, pickup_location: 'Library', destination: 'Park' });
const keys = plans => Array.from(plans, p => p.key);

test('filters distinguish created, joined, combined and all, with rides independent of activity filters', () => {
  const plans = api.buildCalendarPlans({ activities: [activity('own'), activity('joined', 'other'), activity('both'), activity('other', 'other')], joinedIds: new Set(['joined', 'both']), rides: [ride('offered'), ride('accepted', 'other')] }, 'me');
  for (const [filter, expected] of Object.entries({ mine: ['both', 'joined', 'own'], created: ['both', 'own'], joined: ['both', 'joined'], all: ['both', 'joined', 'other', 'own'] })) {
    const selected = api.filterCalendarPlans(plans, filter, false);
    assert.deepEqual(Array.from(selected, p => p.id).sort(), expected);
    assert.equal(api.filterCalendarPlans(plans, filter, true).length, selected.length + 2);
  }
});

test('combined agenda sorts by instant, deduplicates, excludes invalid dates and canceled/completed rides', () => {
  const plans = api.buildCalendarPlans({ activities: [activity('same'), activity('same'), activity('invalid', 'me', null), activity('bad', 'me', 'bad'), activity('canceled', 'me', '2026-10-24T18:00:00Z', 'cancelled')], joinedIds: new Set(['same']),
    rides: [ride('same'), ride('same'), ride('canceled', 'me', 'cancelled'), ride('done', 'me', 'completed'), ride('bad', 'me', 'open', null)] }, 'me');
  assert.deepEqual(keys(plans), ['ride:same', 'activity:same']);
  assert.equal(plans[0].label, 'Driving');
  assert.equal(plans[1].label, 'Hosting');
  assert.equal(plans.filter(p => p.startsAt >= Date.parse('2026-10-24T17:30:00Z')).length, 1);
});

test('calendar dots/grouping use local dates across midnight and daylight saving', () => {
  assert.equal(api.calendarDay(Date.parse('2026-10-24T03:00:00Z')), '2026-10-23');
  assert.equal(api.calendarDay(Date.parse('2026-11-01T05:30:00Z')), '2026-11-01');
  const plans = api.buildCalendarPlans({ activities: [activity('late', 'me', '2026-10-24T03:00:00Z'), activity('next', 'me', '2026-10-24T06:00:00Z')], joinedIds: new Set(), rides: [] }, 'me');
  assert.deepEqual(Array.from(api.groupCalendarPlans(plans), g => g.day), ['2026-10-23', '2026-10-24']);
  assert.equal(api.calendarPlanRoute(plans[0]).pathname, '/activity/[id]');
  assert.equal(api.calendarPlanRoute({ ...plans[0], kind: 'ride' }).pathname, '/ride/[id]');
});

function service({ tables, cap = 100, fail, user = 'me' }) {
  const queries = [], listeners = [];
  let removed = 0;
  const supabase = {
    auth: { getUser: async () => ({ data: { user: { id: user } }, error: null }) },
    from(table) {
      let start = 0, end = 499;
      const filters = [];
      const query = {
        select() { return query; }, order() { return query; },
        eq(key, value) { filters.push(row => row[key] === value); return query; },
        in(key, values) { filters.push(row => values.includes(row[key])); return query; },
        not(key, _op, value) { filters.push(row => row[key] !== value); return query; },
        range(from, to) { start = from; end = to; return query; },
        async abortSignal(signal) {
          assert.equal(signal.aborted, false);
          queries.push({ table, start });
          if (fail?.(table, start)) return { error: Error('offline'), data: null };
          return { error: null, data: (tables[table] ?? []).filter(row => filters.every(fn => fn(row))).slice(start, Math.min(end + 1, start + cap)) };
        },
      };
      return query;
    },
    channel() { const channel = { on(_type, filter, cb) { listeners.push({ ...filter, cb }); return channel; }, subscribe(cb) { cb('SUBSCRIBED'); return channel; } }; return channel; },
    removeChannel() { removed++; },
  };
  return { ...load('services/calendar-plans-service.ts', { '@/lib/supabase': { supabase }, '@/lib/calendar-plans': api }), queries, listeners, removed: () => removed };
}

test('loader paginates, scopes membership to current user, and includes only owned or accepted rides', async () => {
  const tables = {
    activities: Array.from({ length: 1103 }, (_, i) => activity(`event${i}`, 'other')),
    rsvps: [{ activity_id: 'event1', user_id: 'me' }, { activity_id: 'event2', user_id: 'other' }],
    rides_offered: [ride('own'), ride('accepted', 'other', 'full'), ride('pending', 'other'), ride('someone-else', 'other'), ride('canceled', 'other', 'cancelled')],
    ride_requests: [
      { id: '1', ride_id: 'accepted', requester_id: 'me', status: 'accepted' },
      { id: '2', ride_id: 'accepted', requester_id: 'me', status: 'accepted' },
      { id: '3', ride_id: 'pending', requester_id: 'me', status: 'pending' },
      { id: '4', ride_id: 'someone-else', requester_id: 'other', status: 'accepted' },
      { id: '5', ride_id: 'canceled', requester_id: 'me', status: 'accepted' },
    ],
  };
  const store = service({ tables });
  const plans = await store.loadCalendarPlans('me', new AbortController().signal);
  assert.equal(plans.filter(p => p.kind === 'activity').length, 1103);
  assert.deepEqual(keys(plans.filter(p => p.kind === 'ride')).sort(), ['ride:accepted', 'ride:own']);
  assert.equal(plans.find(p => p.id === 'event1').joined, true);
  assert.equal(plans.find(p => p.id === 'event2').joined, false);
  assert.ok(store.queries.some(q => q.table === 'activities' && q.start >= 1000));
  // The same refresh reflects leaving, acceptance changes and activity edits.
  tables.rsvps = [];
  tables.ride_requests[0].status = 'cancelled'; tables.ride_requests[1].status = 'cancelled';
  tables.activities[1].date_time = '2026-10-27T12:00:00Z';
  const updated = await store.loadCalendarPlans('me', new AbortController().signal);
  assert.equal(updated.find(p => p.id === 'event1').joined, false);
  assert.equal(updated.find(p => p.id === 'event1').startsAt, Date.parse('2026-10-27T12:00:00Z'));
  assert.ok(!updated.some(p => p.key === 'ride:accepted'));
});

test('failed later pages and switched accounts never return partial results', async () => {
  const store = service({ tables: { activities: Array.from({ length: 101 }, (_, i) => activity(String(i))) }, fail: (table, start) => table === 'activities' && start > 0 });
  await assert.rejects(store.loadCalendarPlans('me', new AbortController().signal), /Could not refresh/);
  const switched = service({ tables: {}, user: 'other' });
  await assert.rejects(switched.loadCalendarPlans('me', new AbortController().signal), /Sign in again/);
  assert.equal(switched.queries.length, 0);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(service({ tables: {} }).loadCalendarPlans('me', controller.signal), /canceled/);
});

test('live updates cover membership removals, activities, rides, and seat requests; cleanup removes channel', () => {
  const store = service({ tables: {} }); let changes = 0;
  const stop = store.subscribeToCalendarPlans(() => changes++);
  assert.equal(changes, 1); // subscription/reconnect
  assert.deepEqual(store.listeners.map(l => l.table), ['activities', 'rsvps', 'rides_offered', 'ride_requests']);
  store.listeners.forEach(l => { assert.equal(l.event, '*'); l.cb({ eventType: 'DELETE' }); });
  assert.equal(changes, 5); stop(); assert.equal(store.removed(), 1);
});

const settle = () => new Promise(resolve => setImmediate(resolve));
function hookHarness(loader) {
  const slots = [], timers = new Map(), intervals = new Map();
  let cursor = 0, nextTimer = 0, focused = true, userId = 'me', focusHook, live, appListener, subscriptions = 0;
  const react = {
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial; return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }]; },
    useRef(value) { const i = cursor++; return slots[i] ??= { current: value }; },
    useCallback(fn, deps) { const i = cursor++; if (!slots[i] || deps.some((v, j) => v !== slots[i].deps[j])) slots[i] = { fn, deps }; return slots[i].fn; },
  };
  const { useCalendarPlans } = load('hooks/use-calendar-plans.ts', {
    react,
    'react-native': { AppState: { currentState: 'active', addEventListener: (_event, fn) => { appListener = fn; return { remove() { appListener = null; } }; } } },
    'expo-router': { useFocusEffect(fn) {
      if (!focusHook || focusHook.fn !== fn || focusHook.focused !== focused) {
        focusHook?.cleanup?.(); focusHook = { fn, focused, pending: focused };
      }
    } },
    '@/hooks/use-auth-context': { useAuthContext: () => ({ claims: userId ? { sub: userId } : null }) },
    '@/services/calendar-plans-service': { loadCalendarPlans: loader, subscribeToCalendarPlans: fn => { live = fn; subscriptions++; return () => { live = null; subscriptions--; }; } },
  }, { setTimeout: fn => { const id = ++nextTimer; timers.set(id, fn); return id; }, clearTimeout: id => timers.delete(id), setInterval: fn => { const id = ++nextTimer; intervals.set(id, fn); return id; }, clearInterval: id => intervals.delete(id) });
  function render() { cursor = 0; const state = useCalendarPlans(); if (focusHook?.pending) { focusHook.pending = false; focusHook.cleanup = focusHook.fn(); } return state; }
  return { render, live: () => live?.(), app: state => appListener?.(state),
    focus(value) { focused = value; return render(); }, account(value) { userId = value; return render(); },
    debounce() { const pending = [...timers.values()]; timers.clear(); pending.forEach(fn => fn()); },
    poll() { intervals.forEach(fn => fn()); }, subscriptions: () => subscriptions, timers: () => timers.size + intervals.size };
}

test('calendar refreshes on focus, app resume, manual refresh and debounced live events', async () => {
  let calls = 0;
  const hook = hookHarness(async () => [{ id: String(++calls) }]);
  hook.render(); await settle(); assert.equal(hook.render().plans[0].id, '1');
  hook.render().refresh(); await settle(); assert.equal(calls, 2);
  hook.live(); hook.live(); hook.live(); hook.debounce(); await settle(); assert.equal(calls, 3);
  hook.app('background'); hook.poll(); await settle(); assert.equal(calls, 3);
  hook.app('active'); await settle(); assert.equal(calls, 4);
  hook.focus(false); assert.equal(hook.subscriptions(), 0); assert.equal(hook.timers(), 0);
  hook.focus(true); await settle(); assert.equal(calls, 5);
  hook.poll(); await settle(); assert.equal(calls, 6);
  hook.focus(false);
});

test('late requests cannot replace another account or a newly focused screen', async () => {
  const requests = [];
  const hook = hookHarness((user, signal) => new Promise(resolve => requests.push({ user, signal, resolve })));
  hook.render(); hook.account('other');
  assert.equal(requests[0].signal.aborted, true);
  requests[1].resolve([{ id: 'other-user-plan' }]); await settle();
  requests[0].resolve([{ id: 'stale-private-plan' }]); await settle();
  assert.equal(hook.render().plans[0].id, 'other-user-plan');
  assert.equal(hook.account(null).plans.length, 0);
  hook.focus(false);
});

test('failed refresh retains existing plans with an error and retry recovers', async () => {
  let calls = 0;
  const hook = hookHarness(async () => { if (++calls === 2) throw Error('Offline'); return [{ id: String(calls) }]; });
  hook.render(); await settle(); hook.render().refresh(); await settle();
  assert.equal(hook.render().plans[0].id, '1'); assert.equal(hook.render().error, 'Offline');
  assert.equal(hook.render().loading, false);
  hook.render().refresh(); await settle(); assert.equal(hook.render().plans[0].id, '3'); assert.equal(hook.render().error, '');
  hook.focus(false);
});
