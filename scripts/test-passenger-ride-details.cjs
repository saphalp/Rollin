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

const colors = {
  tint: 'blue', onPrimary: 'white', error: 'red', cardBackground: 'card', surfaceContainer: 'surface',
  outlineVariant: 'outline', verifiedContainer: 'green-bg', onVerifiedContainer: 'green',
  secondaryContainer: 'amber-bg', onSecondaryContainer: 'amber', text: 'text', icon: 'icon',
};
const common = {
  '@expo/vector-icons': { MaterialCommunityIcons: 'Icon' },
  'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }), Fragment: 'Fragment' },
  'react-native': { StyleSheet: { create: x => x }, View: 'View', TouchableOpacity: 'TouchableOpacity', ActivityIndicator: 'ActivityIndicator' },
  '@/components/text': { AppText: 'Text' },
  '@/constants/theme': { Colors: { light: colors }, Fonts: {} },
  '@/hooks/use-color-scheme': { useColorScheme: () => 'light' },
};
const nodes = n => (!n || typeof n !== 'object' ? [] : [n, ...[n.props?.children].flat(Infinity).flatMap(nodes)]);
const texts = tree => nodes(tree).filter(n => n.type === 'Text').map(n => [n.props.children].flat().join(''));

test('the seat panel explains each stage and shows the passenger\'s pickup', () => {
  const { PassengerSeatPanel } = compile('components/rides/passenger-seat-panel.tsx', common);
  const ride = { status: 'open', pickupLocation: 'Union', driver: { name: 'Dana Driver' } };

  const pending = texts(PassengerSeatPanel({ ride, request: { status: 'pending', pickupAddress: 'Library' } }));
  assert.ok(pending.includes('Pending') && pending.includes('Waiting for Dana to accept your request.'));
  assert.ok(pending.includes('Library'));

  const confirmed = texts(PassengerSeatPanel({ ride, request: { status: 'accepted', pickupAddress: null } }));
  assert.ok(confirmed.includes('Confirmed') && confirmed.includes('Your seat is confirmed'));
  assert.ok(confirmed.includes('Union'), 'falls back to the ride\'s pickup');

  const driving = texts(PassengerSeatPanel({ ride: { ...ride, status: 'in_progress' }, request: { status: 'accepted' } }));
  assert.ok(driving.includes('On the way') && driving.includes('Dana is on the way'));
});

test('cancelling a seat or request is shown in red; requesting stays blue', () => {
  const { RideRequestButton } = compile('components/rides/ride-request-button.tsx', common);
  const render = request => RideRequestButton({ request, loading: false, onRequest: () => {}, onCancel: () => {} });
  const labelColor = tree => nodes(tree).find(n => n.type === 'Text').props.style[1].color;

  assert.equal(labelColor(render({ status: 'accepted' })), 'red');
  assert.equal(nodes(render({ status: 'accepted' }))[0].props.style[1].borderColor, 'red');
  assert.equal(labelColor(render({ status: 'pending' })), 'red');
  assert.equal(labelColor(render(null)), 'white');
});
