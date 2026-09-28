const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const ts = require('typescript');
const code = ts.transpileModule(fs.readFileSync('components/rides/rating-reminder.tsx', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const target = ride_id => ({ ride_id, recipient_id: 'driver', name: 'Driver', destination: 'Campus' });
const settle = () => new Promise(resolve => setImmediate(resolve));

function mount(storage, { user = 'passenger', targets = [target('ride-1')], pathname = '/rides', failStorage = false } = {}) {
  const alerts = [], effects = [], timers = [], exports = {};
  const storageAPI = {
    getItem: async key => storage.get(key) ?? null,
    setItem: async (key, value) => { if (failStorage) throw Error('Storage unavailable'); storage.set(key, value); },
  };
  vm.runInNewContext(code, {
    exports,
    setInterval: fn => { timers.push(fn); return 1; }, clearInterval() {},
    require(name) {
      if (name === 'react') return { useRef: value => ({ current: value }), useEffect: fn => effects.push(fn) };
      if (name === 'react-native') return {
        Alert: { alert: (...args) => alerts.push(args) },
        AppState: { currentState: 'active', addEventListener: () => ({ remove() {} }) },
      };
      if (name === 'expo-router') return { router: { push() {} }, usePathname: () => pathname };
      if (name === '@/hooks/use-auth-context') return { useAuthContext: () => ({ profile: { id: user } }) };
      if (name === '@/services/ride-ratings-service') return { ratingTargets: async () => targets };
      if (name === '@react-native-async-storage/async-storage') return { __esModule: true, default: storageAPI };
      throw Error(name);
    },
  });
  exports.RatingReminder();
  const cleanups = effects.map(fn => fn());
  return { alerts, poll: () => timers.forEach(fn => fn()), unmount: () => cleanups.forEach(fn => fn()) };
}

test('shown reminder stays dismissed after reload, including Not now', async () => {
  const storage = new Map();
  const first = mount(storage);
  await settle();
  assert.equal(first.alerts.length, 1);
  first.alerts[0][2][0].onPress();
  first.unmount();
  const reopened = mount(storage);
  await settle();
  assert.equal(reopened.alerts.length, 0);
  reopened.unmount();
});

test('another account and a newly completed ride still get reminders', async () => {
  const storage = new Map([['rollin:rating-reminder:v1:passenger:ride-1', 'shown']]);
  for (const options of [{ user: 'another-passenger' }, { targets: [target('ride-1'), target('ride-2')] }]) {
    const app = mount(storage, options);
    await settle();
    assert.equal(app.alerts.length, 1);
    app.unmount();
  }
});

test('polling cannot stack reminders while an alert remains open', async () => {
  const app = mount(new Map(), { targets: [target('ride-1'), target('ride-2')] });
  await settle();
  app.poll(); await settle();
  assert.equal(app.alerts.length, 1);
  app.alerts[0][3].onDismiss();
  app.poll(); await settle();
  assert.equal(app.alerts.length, 2);
  app.unmount();
});

test('ratings screen, unmount, and failed persistence do not produce alerts', async () => {
  const ratings = mount(new Map(), { pathname: '/ride/ratings/ride-1' });
  const unmounted = mount(new Map()); unmounted.unmount();
  const failed = mount(new Map(), { failStorage: true });
  await settle();
  for (const app of [ratings, unmounted, failed]) assert.equal(app.alerts.length, 0);
  ratings.unmount(); failed.unmount();
});
