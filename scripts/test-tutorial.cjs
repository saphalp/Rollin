const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const ts = require('typescript');

function load(file, mocks, globals = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(code, { exports, console, Date, ...globals, require: name => {
    if (!(name in mocks)) throw Error(`Missing mock: ${name}`);
    return mocks[name];
  } });
  return exports;
}
const settle = () => new Promise(resolve => setImmediate(resolve));
function renderComponent(file, exportName, props, extraMocks = {}) {
  const state = [], refs = [], effects = [], timers = [];
  let cursor, refCursor;
  const jsx = (type, props) => ({ type, props });
  const react = {
    useState(value) { const i = cursor++; if (!(i in state)) state[i] = value; return [state[i], next => { state[i] = typeof next === 'function' ? next(state[i]) : next; }]; },
    useRef(value) { const i = refCursor++; return refs[i] ??= { current: value }; },
    useEffect(fn) { if (!effects.length) effects.push(fn); },
  };
  const mocks = {
    react, 'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': { ActivityIndicator: 'Spinner', View: 'View', ScrollView: 'ScrollView', StyleSheet: { create: x => x } },
    'react-native-paper': { Text: 'Text', Button: 'Button' },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    '@/constants/theme': { Colors: { light: {} } },
    '@/hooks/use-color-scheme': { useColorScheme: () => 'light' },
    '@/components/ui/icon-symbol': { IconSymbol: 'Icon' },
    './tutorial': { Tutorial: 'Tutorial' },
    './tutorial-steps': load('components/tutorial/tutorial-steps.ts', {}),
    ...extraMocks,
  };
  const component = load(file, mocks, { setTimeout: fn => { timers.push(fn); return timers.length; }, clearTimeout() {} })[exportName];
  const render = () => { cursor = 0; refCursor = 0; return component(props); };
  function nodes(node) {
    if (!node || typeof node !== 'object') return [];
    return [node, ...[node.props?.children].flat(Infinity).flatMap(nodes)];
  }
  render();
  return {
    render, timers,
    start: () => effects[0](),
    button: text => nodes(render()).find(n => n.type === 'Button' && n.props.children === text),
    text: () => nodes(render()).filter(n => n.type === 'Text').map(n => n.props.children).flat().join(' ').replace(/\s+/g, ' '),
  };
}
function service(auth) { return load('lib/tutorial.ts', { '@/lib/supabase': { supabase: { auth } } }); }

test('new accounts see tutorial; both completed and skipped accounts suppress it', async () => {
  for (const outcome of [undefined, 'completed', 'skipped', 'invalid']) {
    const api = service({ getUser: async () => ({ data: { user: { id: 'a', user_metadata: { rollin_tutorial_v1: { outcome } } } } }) });
    assert.equal(await api.hasFinishedTutorial('a'), ['completed', 'skipped'].includes(outcome));
  }
});

test('finish and skip persist on the authenticated account through metadata', async () => {
  for (const outcome of ['completed', 'skipped']) {
    let written;
    const api = service({
      getUser: async () => ({ data: { user: { id: 'a' } } }),
      updateUser: async args => { written = args; return { error: null }; },
    });
    await api.finishTutorial('a', outcome);
    assert.equal(written.data.rollin_tutorial_v1.outcome, outcome);
    assert.ok(Number.isFinite(Date.parse(written.data.rollin_tutorial_v1.finished_at)));
    assert.deepEqual(Object.keys(written.data), ['rollin_tutorial_v1']);
  }
});

test('account changes and failed saves do not report completion', async () => {
  let writes = 0;
  const switched = service({ getUser: async () => ({ data: { user: { id: 'b' } } }), updateUser: async () => { writes++; } });
  await assert.rejects(() => switched.finishTutorial('a', 'completed'), /account changed/);
  assert.equal(writes, 0);
  const offline = service({ getUser: async () => ({ data: { user: { id: 'a' } } }), updateUser: async () => ({ error: Error('offline') }) });
  await assert.rejects(() => offline.finishTutorial('a', 'skipped'), /offline/);
});

const gateFile = 'components/tutorial/first-login-tutorial.tsx';
function gate(api) { return renderComponent(gateFile, 'FirstLoginTutorial', { userId: 'a', children: 'APP' }, { '@/lib/tutorial': api }); }

test('gate shows guide for a new account and unlocks tabs only after successful save', async () => {
  let outcome;
  const app = gate({ hasFinishedTutorial: async () => false, finishTutorial: async (_, value) => { outcome = value; } });
  const cleanup = app.start();
  await settle();
  assert.equal(app.render().type, 'Tutorial');
  await app.render().props.onFinish('skipped');
  assert.equal(outcome, 'skipped');
  assert.equal(app.render(), 'APP');
  cleanup();
});

test('saved accounts go directly to tabs and unmount ignores pending lookup', async () => {
  const app = gate({ hasFinishedTutorial: async () => true });
  app.start(); await settle(); assert.equal(app.render(), 'APP');
  let resolve;
  const pending = gate({ hasFinishedTutorial: () => new Promise(r => { resolve = r; }) });
  const cleanup = pending.start(); cleanup(); resolve(false); await settle();
  assert.equal(pending.render().type, 'View');
});

test('late lookup after timeout cannot reopen a dismissed tutorial', async () => {
  let resolve;
  const app = gate({ hasFinishedTutorial: () => new Promise(r => { resolve = r; }) });
  app.start(); app.timers[0]();
  assert.equal(app.render().type, 'Tutorial');
  app.render().props.onContinueWithoutSaving();
  resolve(false); await settle();
  assert.equal(app.render(), 'APP');
});

test('tutorial supports Back, all six steps, and completion on the final page', async () => {
  const outcomes = [];
  const app = renderComponent('components/tutorial/tutorial.tsx', 'Tutorial', { onFinish: async value => outcomes.push(value) });
  assert.equal(app.button('Back').props.disabled, true);
  app.button('Next').props.onPress();
  assert.match(app.text(), /Step 2 of 6/);
  app.button('Back').props.onPress();
  assert.match(app.text(), /Step 1 of 6/);
  for (let i = 0; i < 5; i++) app.button('Next').props.onPress();
  assert.match(app.text(), /Step 6 of 6/);
  app.button('Start exploring').props.onPress(); await settle();
  assert.deepEqual(outcomes, ['completed']);
});

test('Skip saves skipped outcome and a failed save offers continuation without claiming success', async () => {
  let saved, continued = false;
  const app = renderComponent('components/tutorial/tutorial.tsx', 'Tutorial', {
    onFinish: async outcome => { saved = outcome; throw Error('offline'); },
    onContinueWithoutSaving: () => { continued = true; },
  });
  app.button('Skip').props.onPress(); await settle();
  assert.equal(saved, 'skipped');
  assert.match(app.text(), /couldn't save/);
  assert.equal(app.button('Skip').props.disabled, false);
  app.button('Continue without saving').props.onPress();
  assert.equal(continued, true);
});
