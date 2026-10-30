const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const ts = require('typescript');
function compile(path, dependencies) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { exports, require: name => {
    if (!(name in dependencies)) throw Error(name);
    return dependencies[name];
  }, console });
  return exports;
}
test('activity offers stay scoped and own offers are opt-in', async () => {
  const calls = [];
  const query = { then(resolve) { resolve({ data: [], error: null }); } };
  for (const method of ['select', 'eq', 'gt', 'neq', 'gte', 'order', 'not', 'is']) {
    query[method] = (...args) => { calls.push([method, ...args]); return query; };
  }
  const { fetchAvailableRides } = compile('services/rides-service.ts', {
    '@/lib/supabase': { supabase: { auth: { getUser: async () => ({ data: { user: { id: 'me' } } }) }, from: () => query } },
  });
  await fetchAvailableRides({ activityId: 'A', includeOwn: true });
  assert.ok(calls.some(c => c[0] === 'eq' && c[1] === 'activity_id' && c[2] === 'A'));
  assert.ok(calls.some(c => c[0] === 'eq' && c[1] === 'status' && c[2] === 'open'));
  assert.ok(calls.some(c => c[0] === 'gt' && c[1] === 'available_seats' && c[2] === 0));
  assert.ok(calls.some(c => c[0] === 'gte' && c[1] === 'date_time'));
  assert.ok(!calls.some(c => c[0] === 'neq'));
  calls.length = 0;
  await fetchAvailableRides();
  assert.ok(calls.some(c => c[0] === 'neq' && c[1] === 'driver_id' && c[2] === 'me'));
});
function mount(fetch) {
  const states = [], routes = [], details = [];
  let cursor = 0, focus, change, unsubscribed = false;
  const jsx = (type, props) => ({ type, props });
  const { ActivityRidesSection } = compile('components/activity/activity-rides-section.tsx', {
    react: { useCallback: fn => fn, useState: initial => { const i = cursor++; if (!(i in states)) states[i] = initial; return [states[i], value => { states[i] = typeof value === 'function' ? value(states[i]) : value; }]; } },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'expo-router': { useFocusEffect: fn => { focus = fn; }, router: { push: route => routes.push(route) } },
    'react-native': { ActivityIndicator: 'Loading', TouchableOpacity: 'Button', View: 'View', StyleSheet: { create: x => x } },
    'expo-image': { Image: 'Image' },
    '@/components/ui/icon-symbol': { IconSymbol: 'Icon' },
    '@/components/text': { AppText: 'Text' },
    '@/constants/theme': { Colors: { light: {} } },
    '@/hooks/use-color-scheme': { useColorScheme: () => 'light' },
    '@/navigation/ride-navigation': { openRideDetails: id => details.push(id) },
    '@/services/rides-service': { fetchAvailableRides: fetch, subscribeToRideOffers: fn => { change = fn; return () => { unsubscribed = true; }; } },
  });
  function render() { cursor = 0; return ActivityRidesSection({ activityId: 'A' }); }
  function nodes(node = render()) { return !node || typeof node !== 'object' ? [] : [node, ...[node.props?.children].flat(Infinity).flatMap(n => nodes(n ?? null))]; }
  render();
  function text(node) { return typeof node === 'string' ? node : [node?.props?.children].flat(Infinity).map(child => child ? text(child) : '').join(''); }
  return { nodes, routes, details, focus: () => focus(), change: () => change(), unsubscribed: () => unsubscribed, button: label => nodes().find(n => n.type === 'Button' && text(n).includes(label)) };
}
const settle = () => new Promise(resolve => setImmediate(resolve));
const previewRide = id => ({ id, driver: { name: `Driver ${id}`, avatarUrl: null }, dateTime: '2026-11-01T18:00:00Z', pickupLocation: 'Campus', availableSeats: 2 });
test('preview links requests, offers and full list to the activity even with existing rides', async () => {
  const app = mount(async options => { assert.equal(options.activityId, 'A'); return [1,2,3,4].map(previewRide); });
  const cleanup = app.focus();
  await settle();
  const cards = [1, 2, 3, 4].map(id => app.button(`Driver ${id}`)).filter(Boolean);
  assert.equal(cards.length, 3);
  cards[0].props.onPress();
  assert.equal(app.details[0], 1);
  for (const label of ['Request a Ride', 'Offer a Ride', 'View all rides']) app.button(label).props.onPress();
  assert.deepEqual(app.routes.map(r => r.pathname), ['/ride/request', '/ride/offer', '/ride/available']);
  assert.ok(app.routes.every(r => r.params.activityId === 'A'));
  cleanup();
  assert.equal(app.unsubscribed(), true);
});
test('loading and errors preserve actions, and returning to the page refreshes offers', async () => {
  let fail = true;
  const app = mount(async () => { if (fail) throw Error('offline'); return [previewRide('new')]; });
  const cleanup = app.focus();
  assert.ok(app.nodes().some(n => n.type === 'Loading'));
  assert.ok(app.button('Request a Ride'));
  await settle();
  assert.ok(app.button('Tap to retry'));
  cleanup();
  fail = false;
  app.focus();
  await settle();
  app.button('Driver new').props.onPress();
  assert.equal(app.details[0], 'new');
});
test('late responses after leaving the activity do not update the preview', async () => {
  let finish;
  const app = mount(() => new Promise(resolve => { finish = resolve; }));
  const cleanup = app.focus();
  cleanup();
  finish([previewRide('stale')]);
  await settle();
  assert.equal(app.button('Driver stale'), undefined);
});
test('request form cannot post an unlinked request after an activity lookup fails', async () => {
  let cursor = 0, effect, fail = true;
  const state = [], submitted = [], alerts = [], routes = [];
  const jsx = (type, props) => ({ type, props });
  const components = ['OfferRideForm', 'OfferRideHeader', 'OfferRideIntroCard', 'AppView'];
  const deps = {
    react: { useState: initial => { const i = cursor++; if (!(i in state)) state[i] = initial; return [state[i], v => { state[i] = typeof v === 'function' ? v(state[i]) : v; }]; }, useEffect: fn => { effect = fn; } },
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'expo-router': { useLocalSearchParams: () => ({ activityId: 'A' }), router: { replace: r => routes.push(r) } },
    'react-native': { Alert: { alert: (...args) => alerts.push(args) }, Platform: { OS: 'android' }, StyleSheet: { create: x => x }, ScrollView: 'ScrollView', KeyboardAvoidingView: 'KeyboardAvoidingView' },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ bottom: 0 }) },
    'react-native-paper': { Button: 'Button', Text: 'Text' },
    '@/constants/theme': { Colors: { light: {} } },
    '@/hooks/use-color-scheme': { useColorScheme: () => 'light' },
    '@/services/ride-wanted-requests-service': { createWantedRequest: async args => submitted.push(args) },
    '@/lib/supabase': { supabase: { from: () => { const q = { select: () => q, eq: () => q, single: async () => fail ? { error: Error('offline') } : { data: { id: 'A', title: 'Activity A', location: 'Campus' } } }; return q; } } },
  };
  for (const [i, path] of ['@/components/rides/offer/offer-ride-form', '@/components/rides/offer/offer-ride-header', '@/components/rides/offer/offer-ride-intro-card', '@/components/view'].entries()) deps[path] = { [components[i]]: components[i] };
  const Screen = compile('app/ride/request.tsx', deps).default;
  function render() { cursor = 0; return Screen(); }
  function nodes(node = render()) { return !node || typeof node !== 'object' ? [] : [node, ...[node.props?.children].flat(Infinity).flatMap(n => nodes(n ?? null))]; }
  render(); effect(); await settle();
  assert.equal(nodes().some(n => n.type === 'OfferRideForm'), false);
  const retry = nodes().find(n => n.type === 'Button');
  assert.equal(retry.props.children, 'Retry');
  assert.equal(submitted.length, 0);
  fail = false; retry.props.onPress(); render(); effect(); await settle();
  let form = nodes().find(n => n.type === 'OfferRideForm');
  assert.equal(form.props.destination, 'Campus');
  form.props.onPickupLocationChange('Library');
  form.props.onRideDateTimeChange(new Date(Date.now() + 86400000));
  form = nodes().find(n => n.type === 'OfferRideForm');
  await form.props.onSubmit();
  assert.equal(submitted[0].activityId, 'A');
  assert.equal(submitted[0].destination, 'Campus');
  alerts.at(-1)[2][0].onPress();
  assert.equal(routes[0].params.id, 'A');
});
test('activity ride form locks the date while time edits retain the activity day', () => {
  const jsx = (type, props) => ({ type, props });
  const { OfferRideForm } = compile('components/rides/offer/offer-ride-form.tsx', {
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'react-native': { Switch: 'Switch', View: 'View', TouchableOpacity: 'Button', StyleSheet: { create: x => x } },
    '@/components/post/date-time-field': { DateTimeField: 'DateTimeField' },
    '@/components/post/location-autocomplete-field': { LocationAutocompleteField: 'LocationField' },
    '@/components/post/post-field': { PostField: 'PostField' },
    '@/components/text': { AppText: 'Text' },
    '@/constants/theme': { Colors: { light: {} }, Fonts: {} },
    '@/hooks/use-color-scheme': { useColorScheme: () => 'light' },
  });
  function nodes(node) { return !node || typeof node !== 'object' ? [] : [node, ...[node.props?.children].flat(Infinity).flatMap(nodes)]; }
  let selected;
  const fixedDate = new Date(2030, 0, 2, 18, 0);
  const props = { fixedDate, rideDateTime: null, onRideDateTimeChange: date => { selected = date; } };
  const fields = nodes(OfferRideForm(props)).filter(n => n.type === 'DateTimeField');
  assert.equal(fields.length, 1);
  assert.equal(fields[0].props.mode, 'time');
  fields[0].props.onChange(new Date(2031, 5, 20, 16, 35));
  assert.equal(selected.getFullYear(), 2030);
  assert.equal(selected.getMonth(), 0);
  assert.equal(selected.getDate(), 2);
  assert.equal(selected.getHours(), 16);
  assert.equal(selected.getMinutes(), 35);
  assert.equal(nodes(OfferRideForm({ ...props, fixedDate: undefined })).filter(n => n.type === 'DateTimeField').length, 2);
});
test('offer screen distinguishes an undated activity from a failed lookup and loads dated offers', async () => {
  for (const status of ['verified', 'pending', null]) for (const date of [null, '2030-10-23T17:30:00+00:00']) {
    let cursor = 0; const effects = [];
    const states = [];
    const jsx = (type, props) => ({ type, props });
    const dependencies = {
      react: { useState: initial => { const i = cursor++; if (!(i in states)) states[i] = initial; return [states[i], value => { states[i] = typeof value === 'function' ? value(states[i]) : value; }]; }, useEffect: fn => { effects.push(fn); } },
      'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
      'expo-router': { useLocalSearchParams: () => ({ activityId: 'pickleball' }), router: {} },
      'react-native': { Alert: {}, Platform: { OS: 'android' }, StyleSheet: { create: x => x }, ScrollView: 'ScrollView', KeyboardAvoidingView: 'KeyboardAvoidingView' },
      'react-native-safe-area-context': { useSafeAreaInsets: () => ({ bottom: 0 }) },
      'react-native-paper': { Text: 'Text', Button: 'Button' },
      '@/constants/theme': { Colors: { light: {} }, Fonts: {} },
      '@/hooks/use-color-scheme': { useColorScheme: () => 'light' },
      '@/lib/supabase': { supabase: { from: () => { const query = { select: () => query, eq: () => query, single: async () => ({ data: { id: 'pickleball', title: 'Pickleball', location: 'Court', date_time: date } }) }; return query; } } },
      '@/components/text': { AppText: 'Text' },
      '@/components/ui/icon-symbol': { IconSymbol: 'IconSymbol' },
      '@/lib/profile/driver-profile': { getDriverProfile: async () => ({ verification_status: status }) },
      '@/services/geocoding-service': {},
      '@/services/ride-wanted-requests-service': {},
    };
    for (const [path, name] of [['@/components/rides/offer/offer-ride-form','OfferRideForm'],['@/components/rides/offer/offer-ride-header','OfferRideHeader'],['@/components/rides/offer/offer-ride-intro-card','OfferRideIntroCard'],['@/components/view','AppView']]) dependencies[path] = { [name]: name };
    const Screen = compile('app/ride/offer.tsx', dependencies).default;
    function render() { cursor = 0; return Screen(); }
    function nodes(n) { return !n || typeof n !== 'object' ? [] : [n, ...[n.props?.children].flat(Infinity).flatMap(nodes)]; }
    render(); effects.forEach(effect => effect()); await settle();
    const tree = nodes(render());
    const form = tree.find(n => n.type === 'OfferRideForm');
    if (status !== 'verified') {
      assert.equal(form, undefined);
      assert.ok(tree.some(n => n.props?.children === 'Go to Edit Profile'));
    } else if (date) {
      assert.ok(form);
      assert.equal(form.props.fixedDate.toISOString(), new Date(date).toISOString());
    } else {
      assert.equal(form, undefined);
      assert.ok(tree.some(n => n.props?.children === 'Activity date not set'));
      assert.ok(!tree.some(n => n.props?.children === 'Retry'));
    }
  }
});
test('activity creation rejects missing or invalid dates before uploads or database calls', async () => {
  const source = ts.createSourceFile('post.tsx', fs.readFileSync('app/(tabs)/post.tsx', 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let handler;
  function find(node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === 'handleCreatePost') handler = node.getText(source);
    ts.forEachChild(node, find);
  }
  find(source);
  assert.ok(handler);
  for (const date of [null, new Date('invalid')]) {
    const alerts = [];
    const context = { title: 'Pickleball', location: 'Court', activityDateTime: date, Alert: { alert: (...args) => alerts.push(args) }, setSaving: () => assert.fail('Must reject before saving') };
    vm.createContext(context);
    vm.runInContext(ts.transpileModule(handler + '\nthis.submit = handleCreatePost;', { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
    await context.submit();
    assert.equal(alerts[0][0], 'Missing date and time');
  }
});
