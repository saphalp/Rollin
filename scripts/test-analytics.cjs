const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const ts = require('typescript');

const settle = () => new Promise(resolve => setImmediate(resolve));

function load({ userId = 'me', insertError = null, insertThrows = false, appState = 'active' } = {}) {
  const inserts = [];
  const state = { userId, appStateListener: null, authListener: null, handler: null, previousCalls: 0, timers: [] };
  const supabase = {
    auth: {
      getSession: async () => ({ data: { session: state.userId ? { user: { id: state.userId } } : null } }),
      onAuthStateChange(fn) { state.authListener = fn; return { data: { subscription: { unsubscribe() { state.authListener = null; } } } }; },
    },
    from(table) {
      assert.equal(table, 'app_events');
      return { insert: async row => { if (insertThrows) throw new Error('offline'); inserts.push(row); return { error: insertError }; } };
    },
  };
  const errorUtils = {
    getGlobalHandler: () => () => { state.previousCalls++; },
    setGlobalHandler(fn) { state.handler = fn; },
  };
  const code = ts.transpileModule(fs.readFileSync('lib/analytics.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  const mocks = {
    'expo-constants': { __esModule: true, default: { expoConfig: { version: '1.2.3' } } },
    'react-native': {
      Platform: { OS: 'android' },
      AppState: { currentState: appState, addEventListener: (_event, fn) => { state.appStateListener = fn; return { remove() { state.appStateListener = null; } }; } },
    },
    '@/lib/supabase': { supabase },
  };
  vm.runInNewContext(code, {
    exports, console: { warn() {} }, Date, Error, String, Promise, __DEV__: false,
    setTimeout: fn => { state.timers.push(fn); return state.timers.length; },
    globalThis: { ErrorUtils: errorUtils },
    require: name => { if (!(name in mocks)) throw new Error(`Missing mock ${name}`); return mocks[name]; },
  });
  return { api: exports, inserts, state, runTimers() { state.timers.splice(0).forEach(fn => fn()); } };
}

test('route patterns drop groups and index, and keep dynamic placeholders', () => {
  const { api } = load();
  assert.equal(api.routePattern(['(tabs)']), '/');
  assert.equal(api.routePattern(['(tabs)', 'explore']), '/explore');
  assert.equal(api.routePattern(['activity', '[id]']), '/activity/[id]');
  assert.equal(api.routePattern(['edit-profile', 'index']), '/edit-profile');
});

test('rows carry platform, version and the signed-in user; screen views set the current screen', async () => {
  const { api, inserts } = load();
  api.trackScreen('/activity/[id]');
  await settle();
  assert.equal(inserts.length, 1);
  assert.equal(inserts[0].event_type, 'screen_view');
  assert.equal(inserts[0].screen, '/activity/[id]');
  assert.equal(inserts[0].platform, 'android');
  assert.equal(inserts[0].app_version, '1.2.3');
  assert.equal(inserts[0].user_id, 'me');
  assert.equal(inserts[0].metadata, null);
});

test('signed-out events are skipped, and failures never throw', async () => {
  const signedOut = load({ userId: null });
  signedOut.api.track('screen_view', { screen: '/' });
  await settle();
  assert.equal(signedOut.inserts.length, 0);

  for (const options of [{ insertThrows: true }, { insertError: { message: 'rls' } }]) {
    const { api } = load(options);
    assert.doesNotThrow(() => api.track('screen_view', { screen: '/' }));
    await settle();
  }
});

test('sessions start on launch and foreground, and end on background with a duration', async () => {
  const { api, inserts, state } = load();
  const stop = api.startAppTracking();
  await settle();
  assert.deepEqual(Array.from(inserts, row => row.event_type), ['session_start']);
  state.appStateListener('inactive');
  state.appStateListener('background');
  await settle();
  assert.equal(inserts[1].event_type, 'session_end');
  assert.equal(typeof inserts[1].metadata.duration_ms, 'number');
  state.appStateListener('background');
  state.appStateListener('active');
  state.appStateListener('active');
  await settle();
  assert.deepEqual(Array.from(inserts, row => row.event_type), ['session_start', 'session_end', 'session_start']);
  stop();
  assert.equal(state.appStateListener, null);
  assert.equal(state.authListener, null);
});

test('a launch while signed out starts the session once the user signs in', async () => {
  const { api, inserts, state, runTimers } = load({ userId: null });
  api.startAppTracking();
  await settle();
  assert.equal(inserts.length, 0);
  state.userId = 'me';
  state.authListener('SIGNED_IN');
  runTimers();
  await settle();
  assert.deepEqual(Array.from(inserts, row => row.event_type), ['session_start']);
  state.authListener('SIGNED_IN');
  runTimers();
  await settle();
  assert.equal(inserts.length, 1, 'a recorded session is not started again');
});

test('errors record message, name and a short stack on the current screen; repeats are dropped', async () => {
  const { api, inserts, state } = load();
  api.startAppTracking();
  api.trackScreen('/chat/[id]');
  await settle();
  inserts.length = 0;
  const error = new TypeError('boom');
  api.trackError(error, 'boundary');
  api.trackError(error, 'boundary');
  await settle();
  assert.equal(inserts.length, 1);
  assert.equal(inserts[0].event_type, 'error');
  assert.equal(inserts[0].screen, '/chat/[id]');
  assert.equal(inserts[0].metadata.message, 'boom');
  assert.equal(inserts[0].metadata.name, 'TypeError');
  assert.ok(inserts[0].metadata.stack.split('\n').length <= 5);

  state.handler(new Error('uncaught'), true);
  await settle();
  assert.equal(inserts[1].metadata.source, 'global');
  assert.equal(inserts[1].metadata.fatal, true);
  assert.equal(state.previousCalls, 1, 'the previous global handler still runs');
});
