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

const settle = () => new Promise(resolve => setImmediate(resolve));
const passenger = (id, name, pickedUpAt = null, pickupOrder = null) => ({
  requestId: id, name, avatarUrl: 'avatar', pickupAddress: `${name}'s house`, pickedUpAt, pickupOrder, createdAt: null,
});

async function mountPanel(passengers, route = null) {
  let cursor = 0;
  const states = [], effects = [], alerts = [];
  const jsx = (type, props) => ({ type, props });
  const { DriverPickupPanel } = compile('components/rides/drive/driver-pickup-panel.tsx', {
    '@expo/vector-icons': { MaterialCommunityIcons: 'Icon' },
    react: {
      useState: initial => { const i = cursor++; if (!(i in states)) states[i] = initial; return [states[i], value => { states[i] = typeof value === 'function' ? value(states[i]) : value; }]; },
      useEffect: fn => { effects.push(fn); },
      useCallback: fn => fn,
    },
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'react-native': {
      ActivityIndicator: 'ActivityIndicator', StyleSheet: { create: x => x }, TouchableOpacity: 'TouchableOpacity', View: 'View',
      Alert: { alert: (...args) => alerts.push(args) },
    },
    '@/components/rides/drive/passenger-pickup-card': { PassengerPickupCard: 'PassengerPickupCard' },
    '@/components/text': { AppText: 'Text' },
    '@/constants/theme': { Colors: { light: {} }, Fonts: {} },
    '@/hooks/use-color-scheme': { useColorScheme: () => 'light' },
    '@/services/offerer-ride-requests-service': {
      fetchRidePassengers: async () => passengers,
      markPassengerPickedUp: async () => {},
      setPickupOrder: async () => {},
    },
    '@/services/ride-navigation-service': { openGoogleMaps: async () => {} },
  });
  const props = { rideId: 'ride', destination: 'Airport', route, refreshRoute: async () => {}, completing: false, onComplete: () => {} };
  const render = () => { cursor = 0; return DriverPickupPanel(props); };
  render(); effects.forEach(effect => effect()); await settle();
  const nodes = n => (!n || typeof n !== 'object' ? [] : [n, ...[n.props?.children].flat(Infinity).flatMap(nodes)]);
  const tree = nodes(render());
  const texts = tree.filter(n => n.type === 'Text').map(n => [n.props.children].flat().join(''));
  return { tree, texts, alerts };
}

test('Complete ride stays hidden until every passenger is picked up', async () => {
  const waiting = await mountPanel([passenger('a', 'Pat', '2030-01-01T10:00:00Z'), passenger('b', 'Oli')]);
  assert.ok(!waiting.texts.includes('Complete ride'));
  assert.ok(waiting.texts.includes('1 of 2 picked up'));

  const aboard = await mountPanel([passenger('a', 'Pat', '2030-01-01T10:00:00Z'), passenger('b', 'Oli', '2030-01-01T10:05:00Z')]);
  assert.ok(aboard.texts.includes('Complete ride'));
  assert.ok(aboard.texts.includes('Everyone is on board'));
});

test('a ride with no passengers can be completed straight away', async () => {
  const { texts } = await mountPanel([]);
  assert.ok(texts.includes('Complete ride'));
});

test('remaining passengers follow the route order and only the first is next', async () => {
  const route = { stops: [{ requestId: 'c', label: '' }, { requestId: 'a', label: '' }, { requestId: null, label: 'Airport' }] };
  const { tree } = await mountPanel([passenger('a', 'Pat'), passenger('c', 'Cam'), passenger('d', 'Dee', null, 1)], route);
  const cards = tree.filter(n => n.type === 'PassengerPickupCard');
  assert.deepEqual(cards.map(c => [c.props.passenger.name, c.props.stopNumber, c.props.isNext, Boolean(c.props.onMoveUp)]), [
    ['Cam', 1, true, false],
    ['Pat', 2, false, true],
    ['Dee', 3, false, true],
  ]);
});
