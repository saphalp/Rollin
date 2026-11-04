const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const ts = require('typescript');
process.env.TZ = 'America/Chicago';

function evaluate(source, mocks = {}, globals = {}) {
  const exports = {};
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(code, { exports, Date, Set, Map, Error, AbortController, ...globals, require: name => {
    if (!(name in mocks)) throw Error(`Missing mock: ${name}`);
    return mocks[name];
  } });
  return exports;
}
const load = (file, mocks, globals) => evaluate(fs.readFileSync(file, 'utf8'), mocks, globals);
const api = load('lib/schedule-conflicts.ts');
const start = Date.parse('2026-11-01T06:30:00Z');
const activity = (id, minutes = 0, host_id = 'other', status = 'active') => ({ id, title: id, date_time: new Date(start + minutes * 60000).toISOString(), host_id, status });
const target = activity('target');

test('warns at equal times and exactly +/-60 minutes, but not beyond the boundary', () => {
  const rows = [activity('before', -60), activity('equal'), activity('after', 60), activity('too-early', -60.01), activity('too-late', 60.01)];
  assert.deepEqual(Array.from(api.findScheduleConflicts(target, rows), a => a.id), ['before', 'equal', 'after']);
});

test('excludes target, duplicates, canceled and undated rows; keeps recently started activities', () => {
  const rows = [target, activity('both'), activity('both'), activity('canceled', 0, 'other', 'CANCELLED'), activity('started', -30, 'other', 'expired'), { ...activity('missing'), date_time: null }, { ...activity('bad'), date_time: 'invalid' }];
  assert.deepEqual(Array.from(api.findScheduleConflicts(target, rows), a => a.id), ['started', 'both']);
  assert.throws(() => api.findScheduleConflicts({ ...target, date_time: null }, []), /valid start/);
});

test('compares instants across midnight, offsets and the daylight-saving repeated hour', () => {
  const midnight = { ...target, date_time: '2026-10-27T00:15:00-05:00' };
  assert.equal(api.findScheduleConflicts(midnight, [{ ...activity('previous-day'), date_time: '2026-10-26T23:30:00-05:00' }]).length, 1);
  assert.equal(api.findScheduleConflicts(target, [{ ...activity('after-fallback'), date_time: '2026-11-01T01:30:00-06:00' }]).length, 1);
  assert.match(api.scheduleTimeLabel('2026-11-01T01:30:00-06:00'), /1:30 AM/);
});

function service({ user = 'me', authError = null, candidates = [], memberships = [], fail = false, targetRow = target, cap = 2 } = {}) {
  const calls = [];
  const supabase = {
    auth: { getUser: async () => ({ data: { user: { id: user } }, error: authError }) },
    from(table) {
      const filters = [];
      let first = 0, last = 99, single = false, signal;
      const get = (row, key) => key.split('.').reduce((value, name) => value?.[name], row);
      const query = {
        select(fields) { if (table === 'rsvps') assert.match(fields, /activity:activities!inner/); return query; },
        eq(key, value) { filters.push(row => get(row, key) === value); return query; },
        gte(key, value) { filters.push(row => Date.parse(get(row, key)) >= Date.parse(value)); return query; },
        lte(key, value) { filters.push(row => Date.parse(get(row, key)) <= Date.parse(value)); return query; },
        order() { return query; }, range(a, b) { first = a; last = b; return query; },
        abortSignal(value) { signal = value; return query; },
        maybeSingle() { single = true; return query; },
        then(resolve, reject) {
          calls.push({ table, first, single });
          assert.equal(signal.aborted, false);
          if (fail && !single && first > 0) return Promise.resolve({ data: null, error: Error('offline') }).then(resolve, reject);
          const rows = table === 'activities' ? [targetRow, ...candidates].filter(Boolean) : memberships;
          const filtered = rows.filter(row => filters.every(fn => fn(row)));
          return Promise.resolve({ data: single ? filtered[0] ?? null : filtered.slice(first, Math.min(last + 1, first + cap)), error: null }).then(resolve, reject);
        },
      };
      return query;
    },
  };
  return { ...load('services/schedule-conflicts-service.ts', { '@/lib/supabase': { supabase }, '@/lib/schedule-conflicts': api }), calls };
}

test('fresh schedule check includes only this user’s hosted and RSVP activities, with pagination', async () => {
  const hosted = Array.from({ length: 5 }, (_, i) => activity(`host${i}`, i, 'me'));
  const store = service({ candidates: [...hosted, activity('unrelated')], memberships: [
    { user_id: 'me', activity: activity('joined', -15) }, { user_id: 'me', activity: hosted[0] },
    { user_id: 'other', activity: activity('other-user') }, { user_id: 'me', activity: activity('far-away', 120) },
  ] });
  const result = await store.checkScheduleConflicts('target', 'me', new AbortController().signal);
  assert.equal(result.conflicts.length, 6);
  assert.ok(result.conflicts.some(a => a.id === 'joined'));
  assert.ok(!result.conflicts.some(a => ['unrelated', 'other-user', 'far-away'].includes(a.id)));
  assert.ok(store.calls.some(call => call.first === 4));
});

test('checks the latest target start; failed pages, missing dates and changed accounts cannot pass', async () => {
  const store = service({ targetRow: activity('target', 180), candidates: [activity('old-time', 0, 'me'), activity('new-time', 181, 'me')] });
  assert.deepEqual(Array.from((await store.checkScheduleConflicts('target', 'me', new AbortController().signal)).conflicts, a => a.id), ['new-time']);
  await assert.rejects(service({ user: 'other' }).checkScheduleConflicts('target', 'me', new AbortController().signal), /Sign in again/);
  await assert.rejects(service({ targetRow: { ...target, date_time: null } }).checkScheduleConflicts('target', 'me', new AbortController().signal), /valid start/);
  await assert.rejects(service({ fail: true, candidates: [activity('a', 0, 'me'), activity('b', 0, 'me'), activity('c', 0, 'me')] }).checkScheduleConflicts('target', 'me', new AbortController().signal), /Could not check/);
});

const settle = () => new Promise(resolve => setImmediate(resolve));
function guard(loader) {
  const slots = [];
  let cursor = 0, effect, sessionUser = 'me';
  const react = {
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], value => { slots[i] = value; }]; },
    useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial }; },
    useCallback(fn, deps) { const i = cursor++; if (!slots[i] || deps.some((v, j) => v !== slots[i].deps[j])) slots[i] = { fn, deps }; return slots[i].fn; },
  };
  const { useScheduleConflict } = load('hooks/use-schedule-conflict.ts', {
    react, 'expo-router': { useFocusEffect(fn) { if (effect?.fn !== fn) { effect?.cleanup?.(); effect = { fn, start: true }; } } },
    '@/hooks/use-auth-context': { useAuthContext: () => ({ claims: { sub: sessionUser } }) },
    '@/services/schedule-conflicts-service': { checkScheduleConflicts: loader },
  });
  function render() { cursor = 0; const result = useScheduleConflict('target', 'me'); if (effect.start) { effect.start = false; effect.cleanup = effect.fn(); } return result; }
  return { render, blur: () => effect.cleanup(), switchAccount() { sessionUser = 'other'; return render(); } };
}

test('warning waits for explicit choice, cancels safely, and permits joining only after confirmation', async () => {
  const hook = guard(async () => ({ target, conflicts: [activity('joined')] }));
  const pending = hook.render().confirmSchedule(); await settle();
  assert.equal(hook.render().warning.conflicts.length, 1);
  assert.equal(await hook.render().confirmSchedule(), false); // duplicate tap
  hook.render().goBack(); assert.equal(await pending, false);
  const again = hook.render().confirmSchedule(); await settle();
  hook.render().continueJoining(); hook.render().continueJoining();
  assert.equal(await again, true); assert.equal(hook.render().warning, null);
  hook.blur();
});

test('no conflicts proceeds without popup; errors propagate rather than allowing unchecked join', async () => {
  const clear = guard(async () => ({ target, conflicts: [] }));
  assert.equal(await clear.render().confirmSchedule(), true); assert.equal(clear.render().warning, null); clear.blur();
  const failed = guard(async () => { throw Error('Offline'); });
  await assert.rejects(failed.render().confirmSchedule(), /Offline/); failed.blur();
});

test('leaving the screen or switching account cancels both fetches and pending confirmations', async () => {
  let finish, signal;
  const loading = guard((_id, _user, s) => { signal = s; return new Promise(resolve => { finish = resolve; }); });
  const pending = loading.render().confirmSchedule(); loading.blur();
  assert.equal(signal.aborted, true); finish({ target, conflicts: [activity('a')] }); assert.equal(await pending, false);
  const modal = guard(async () => ({ target, conflicts: [activity('a')] }));
  const decision = modal.render().confirmSchedule(); await settle(); modal.switchAccount();
  assert.equal(await decision, false); assert.equal(modal.render().warning, null); modal.blur();
});

// Execute the real screen handlers with controlled dependencies to verify that
// neither public RSVP writes nor private requests happen before confirmation.
function handlers({ joined = false, privateEvent = false, pendingRequest = false, confirm = async () => true } = {}) {
  const source = ts.createSourceFile('screen.tsx', fs.readFileSync('app/activity/[id].tsx', 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const names = new Set(['toggleRsvp', 'handleRequestToJoin']); const definitions = [];
  function visit(node) { if (ts.isFunctionDeclaration(node) && names.has(node.name?.text)) definitions.push(`export ${node.getText(source)}`); else ts.forEachChild(node, visit); }
  visit(source); assert.equal(definitions.length, 2);
  let checks = 0, writes = 0, leaves = 0, busy = false, status;
  const globals = {
    activity: { ...target, event_type: privateEvent ? 'private' : 'public' }, currentUserId: 'me', hasRsvp: joined,
    myRequestStatus: pendingRequest ? 'pending' : 'none', rsvpInFlight: { current: false },
    setRsvpLoading: value => { busy = value; }, setHasRsvp() {}, setRsvpCount() {}, setMyRequestStatus: value => { status = value; }, load() {},
    scheduleConflict: { confirmSchedule: async () => { checks++; return confirm(); } }, Alert: { alert() {} },
    supabase: { functions: { invoke: async () => { leaves++; return { error: null }; } }, from: table => ({
      async insert(row) { assert.equal(table, 'rsvps'); assert.equal(row.user_id, 'me'); writes++; return { error: null }; },
      async upsert(row) { assert.equal(table, 'activity_join_requests'); assert.equal(row.status, 'pending'); writes++; return { error: null }; },
    }) },
  };
  return { ...evaluate(definitions.join('\n'), {}, globals), stats: () => ({ checks, writes, leaves, busy, status }) };
}

test('public joins and private requests cannot write while warning is pending or when canceled', async () => {
  for (const privateEvent of [false, true]) {
    let decide;
    const screen = handlers({ privateEvent, confirm: () => new Promise(resolve => { decide = resolve; }) });
    const action = privateEvent ? screen.handleRequestToJoin : screen.toggleRsvp;
    const first = action(); await settle(); await action();
    assert.equal(screen.stats().checks, 1); assert.equal(screen.stats().writes, 0);
    decide(false); await first; assert.equal(screen.stats().writes, 0); assert.equal(screen.stats().busy, false);
    const second = action(); await settle(); decide(true); await second;
    assert.equal(screen.stats().writes, 1);
    if (privateEvent) assert.equal(screen.stats().status, 'pending');
  }
});

test('leaving and an already pending private request skip conflict checks', async () => {
  const leaving = handlers({ joined: true }); await leaving.toggleRsvp();
  assert.equal(leaving.stats().leaves, 1); assert.equal(leaving.stats().checks, 0);
  const pending = handlers({ privateEvent: true, pendingRequest: true }); await pending.handleRequestToJoin();
  assert.equal(pending.stats().checks, 0); assert.equal(pending.stats().writes, 0);
});

test('dialog displays all conflict names/times and provides public/private confirmation and back dismissal', () => {
  const jsx = (type, props) => ({ type, props }); let yes = 0, no = 0;
  const { ScheduleConflictDialog } = load('components/activity/schedule-conflict-dialog.tsx', {
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': { Modal: 'Modal', Pressable: 'Button', ScrollView: 'Scroll', View: 'View', StyleSheet: { create: value => value } },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }, '@/components/text': { AppText: 'Text' }, '@/lib/schedule-conflicts': api,
  });
  function nodes(node) { return !node || typeof node !== 'object' ? [] : [node, ...[node.props.children].flat(Infinity).flatMap(nodes)]; }
  function text(node) { return typeof node === 'string' ? node : [node?.props?.children].flat(Infinity).map(child => child ? text(child) : '').join(''); }
  for (const privateRequest of [false, true]) {
    const tree = ScheduleConflictDialog({ warning: { target, conflicts: [activity('Pickleball', -30, 'me'), activity('Study group', 30)] }, userId: 'me', privateRequest, onContinue: () => yes++, onGoBack: () => no++ });
    assert.ok(text(tree).includes('Pickleball')); assert.ok(text(tree).includes('Study group')); assert.ok(text(tree).includes('60 minutes'));
    const buttons = nodes(tree).filter(node => node.type === 'Button');
    assert.equal(text(buttons[0]), 'Go back'); assert.equal(text(buttons[1]), privateRequest ? 'Request anyway' : 'Join anyway');
    buttons[1].props.onPress(); tree.props.onRequestClose();
  }
  assert.equal(yes, 2); assert.equal(no, 2);
});
