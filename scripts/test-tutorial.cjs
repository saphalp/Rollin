const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const ts = require('typescript');

function load(file, mocks, globals = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8').replace('function TourSession(', 'export function TourSession('), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(code, { exports, console, Date, ...globals, require: name => {
    if (!(name in mocks)) throw Error(`Missing mock: ${name}`);
    return mocks[name];
  } });
  return exports;
}
function service(auth) { return load('lib/tutorial.ts', { '@/lib/supabase': { supabase: { auth } } }); }

test('new accounts see tutorial; both completed and skipped accounts suppress it', async () => {
  for (const outcome of [undefined, 'completed', 'skipped', 'invalid']) {
    const api = service({ getUser: async () => ({ data: { user: { id: 'a', user_metadata: { rollin_tutorial_v2: { outcome } } } } }) });
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
    assert.equal(written.data.rollin_tutorial_v2.outcome, outcome);
    assert.ok(Number.isFinite(Date.parse(written.data.rollin_tutorial_v2.finished_at)));
    assert.deepEqual(Object.keys(written.data), ['rollin_tutorial_v2']);
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

const steps = load('components/tutorial/tutorial-steps.ts', {});
test('spotlight leaves the explanation outside targets on phone and landscape', () => {
  for (const [w, h] of [[390, 844], [844, 390]]) {
    for (const rect of [{ x: 12, y: 65, width: 36, height: 36 }, { x: 16, y: h - 120, width: w - 32, height: 45 }]) {
      const { hole, cardTop, maxHeight } = steps.spotlightLayout(rect, w, h, 24, 20);
      assert.ok(hole);
      assert.ok(cardTop >= 36);
      assert.ok(cardTop + maxHeight <= h - 32);
      assert.ok(cardTop >= hole.y + hole.height || cardTop + maxHeight <= hole.y);
    }
  }
});
test('missing or viewport-sized targets still leave a usable explanation', () => {
  for (const rect of [null, { x: 0, y: 0, width: 390, height: 844 }]) {
    const layout = steps.spotlightLayout(rect, 390, 844, 24, 20);
    assert.equal(layout.hole, null);
    assert.ok(layout.maxHeight >= 140);
  }
});
test('route mapping distinguishes calendar stack screen from tab screens', () => {
  assert.equal(steps.tourHref('/calendar'), '/calendar');
  assert.equal(steps.tourHref('/'), '/(tabs)');
  assert.equal(steps.tourHref('/rides'), '/(tabs)/rides');
});

const settle = () => new Promise(resolve => setImmediate(resolve));
function session(api) {
  const slots = [], effects = [], pending = [], timers = [], routes = [];
  let cursor = 0;
  let pathname = '/';
  const jsx = (type, props) => ({ type, props });
  const react = {
    createContext: value => ({ value, Provider: 'Context' }), useContext: ctx => ctx.value,
    useState(value) { const i = cursor++; if (!(i in slots)) slots[i] = value; return [slots[i], v => { slots[i] = typeof v === 'function' ? v(slots[i]) : v; }]; },
    useRef(value) { const i = cursor++; return slots[i] ??= { current: value }; },
    useMemo(fn) { cursor++; return fn(); }, useCallback(fn) { cursor++; return fn; },
    useEffect(fn, deps) { const i = cursor++; const old = effects[i]; if (!old || deps.some((x,j) => x !== old.deps[j])) { pending.push(() => { old?.cleanup?.(); effects[i] = { deps, cleanup: fn() }; }); } },
  };
  const { TourSession } = load('components/tutorial/guided-tour-provider.tsx', {
    react, 'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': { View: 'View', Keyboard: { dismiss() {} }, BackHandler: { addEventListener: () => ({ remove() {} }) } },
    'expo-router': { usePathname: () => pathname, router: { replace: route => { routes.push(route); pathname = route.replace('/(tabs)', '') || '/'; } } },
    '@/hooks/use-auth-context': {}, '@/lib/tutorial': api, './tutorial-steps': steps, './tutorial': { Tutorial: 'Tutorial' },
  }, { setTimeout: fn => { timers.push(fn); return timers.length; }, clearTimeout() {} });
  function nodes(node) { return !node || typeof node !== 'object' ? [] : [node, ...[node.props?.children].flat(Infinity).flatMap(nodes)]; }
  let tree;
  function render() { cursor = 0; tree = TourSession({ userId: 'a', eligible: true, children: 'APP' }); while(pending.length) pending.shift()(); return tree; }
  render();
  return { render, routes, timers, visit: path => { pathname = path; routes.push(steps.tourHref(path)); render(); }, tour: () => nodes(render()).find(n => n.type === 'Tutorial'), context: () => render().props.value, unmount: () => effects.forEach(e => e?.cleanup?.()) };
}
test('new account navigates through the live tour, Back works, and Finish saves completion', async () => {
  let outcome;
  const app = session({ hasFinishedTutorial: async () => false, finishTutorial: async (_,v) => { outcome = v; } });
  await settle();
  assert.equal(app.tour().props.step, 0);
  app.tour().props.onNext(); assert.equal(app.tour().props.step, 1);
  app.tour().props.onBack(); assert.equal(app.tour().props.step, 0);
  for(let i=0; i<steps.TUTORIAL_STEPS.length-1; i++) {
    const step = steps.TUTORIAL_STEPS[app.tour().props.step];
    if (step.destination) app.visit(step.destination);
    else app.tour().props.onNext();
  }
  assert.ok(app.routes.includes('/calendar'));
  assert.ok(app.routes.includes('/(tabs)/rides'));
  app.tour().props.onNext(); await settle();
  assert.equal(outcome, 'completed'); assert.equal(app.tour(), undefined);
});
test('saved accounts are not interrupted; replay does not rewrite completion', async () => {
  let writes=0;
  const app = session({ hasFinishedTutorial: async () => true, finishTutorial: async () => { writes++; } });
  await settle(); assert.equal(app.tour(), undefined);
  app.context().start(); assert.equal(app.tour().props.step, 0);
  app.tour().props.onSkip(); await settle();
  assert.equal(writes, 0); assert.equal(app.tour(), undefined);
});
test('failed save offers continuation and late lookup cannot reopen dismissed tour', async () => {
  let resolve;
  const app = session({ hasFinishedTutorial: () => new Promise(r => { resolve=r; }), finishTutorial: async () => { throw Error('offline'); } });
  app.timers[0](); app.tour().props.onSkip(); await settle();
  assert.equal(app.tour().props.error, true);
  app.tour().props.onContinueWithoutSaving();
  resolve(false); await settle(); assert.equal(app.tour(), undefined);
});
test('lookup completing after unmount does not navigate', async () => {
  let resolve;
  const app = session({ hasFinishedTutorial: () => new Promise(r => { resolve=r; }) });
  app.unmount(); resolve(false); await settle(); assert.equal(app.routes.length, 0);
});

test('every overview points to an anchor and leads directly into details for that page', () => {
  const overviews = steps.TUTORIAL_STEPS.filter(s => !s.target);
  assert.equal(overviews.length, 8);
  for (const intro of overviews) {
    assert.ok(intro.anchor);
    const detail = steps.TUTORIAL_STEPS[steps.TUTORIAL_STEPS.indexOf(intro) + 1];
    assert.ok(detail.target);
    assert.equal(detail.route, intro.route);
  }
});
test('overview notes sit above bottom icons and below header icons without covering them', () => {
  for (const x of [12, 180, 354]) {
    const anchor = { x, y: 760, width: 24, height: 24 };
    const note = steps.overviewLayout(anchor, 390, 844, 24, 20);
    assert.equal(note.above, true);
    assert.ok(844 - note.card.bottom < anchor.y);
    assert.ok(note.card.left >= 16);
    assert.ok(note.card.left + note.card.width <= 374);
    assert.ok(844 - note.card.bottom - note.card.maxHeight >= 36);
  }
  const header = steps.overviewLayout({ x: 330, y: 50, width: 24, height: 24 }, 390, 844, 24, 20);
  assert.equal(header.above, false);
  assert.ok(header.card.top > 74);
});
test('moving between details on the current page does not navigate again', async () => {
  const app = session({ hasFinishedTutorial: async () => false });
  await settle();
  const before = app.routes.length;
  app.tour().props.onNext();
  assert.equal(app.tour().props.step, 1);
  assert.equal(app.routes.length, before);
  assert.equal(app.tour().props.onNextPage, undefined);
});

test('navigation practice waits for the requested destination and cannot be advanced with Next', async () => {
  const app = session({ hasFinishedTutorial: async () => false });
  await settle();
  const index = steps.TUTORIAL_STEPS.findIndex(step => step.destination);
  for (let i=0; i<index; i++) app.tour().props.onNext();
  assert.equal(app.tour().props.step, index);
  app.tour().props.onNext();
  assert.equal(app.tour().props.step, index);
  app.visit('/profile');
  assert.equal(app.tour().props.step, index);
  app.visit(steps.TUTORIAL_STEPS[index].destination);
  assert.equal(app.tour().props.step, index + 1);
  app.tour().props.onBack();
  assert.equal(app.tour().props.step, index);
});

test('tutorial buttons preserve complete labels without line limits or fixed height', () => {
  const jsx = (type, props) => ({ type, props });
  const { TourButton } = load('components/tutorial/tour-button.tsx', {
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': { Pressable: 'Pressable', Text: 'Text', StyleSheet: { create: x => x } },
    '@/constants/theme': { Colors: { light: {} } },
    '@/hooks/use-color-scheme': { useColorScheme: () => 'light' },
  });
  for (const label of ['Back', 'Next', 'Continue without saving']) {
    const button = TourButton({ children: label });
    const text = button.props.children;
    assert.equal(text.props.children, label);
    assert.equal(text.props.numberOfLines, undefined);
    assert.equal(text.props.ellipsizeMode, undefined);
    assert.equal(button.props.accessibilityLabel, label);
    const style = button.props.style({ pressed: false })[0];
    assert.equal(style.height, undefined);
    assert.ok(style.minHeight >= 48);
  }
});

test('inactive tab buttons register targets while inactive page content does not', () => {
  const registered = [];
  const jsx = (type, props) => ({ type, props });
  const { TourTarget } = load('components/tutorial/tour-target.tsx', {
    react: { createContext: value => ({ value }), useContext: ctx => ctx.value, useRef: value => ({ current: value }), useEffect: fn => fn() },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': { View: 'View' },
    'expo-router': { useIsFocused: () => false },
    './guided-tour-provider': { useGuidedTour: () => ({ register: id => { registered.push(id); return () => {}; } }) },
  });
  TourTarget({ id: 'tab-explore', alwaysActive: true });
  TourTarget({ id: 'inactive-page-section' });
  assert.deepEqual(registered, ['tab-explore']);
});
test('prompt is visible immediately with no target and has no internal scroll container', () => {
  const jsx = (type, props) => ({ type, props });
  const { Tutorial } = load('components/tutorial/tutorial.tsx', {
    react: { useLayoutEffect() {}, useRef: value => ({ current: value }), useState: value => [typeof value === 'function' ? value() : value, () => {}] },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': { Pressable: 'Pressable', View: 'View', StyleSheet: { create: x => x }, useWindowDimensions: () => ({ width: 390, height: 844, fontScale: 1 }) },
    'react-native-paper': { Text: 'Text' },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 24, bottom: 20 }) },
    'react-native-svg': { __esModule: true, default: 'Svg', Path: 'Path' },
    '@/constants/theme': { Colors: { light: {} } },
    '@/hooks/use-color-scheme': { useColorScheme: () => 'light' },
    './tour-button': { TourButton: 'TourButton' },
    './tutorial-steps': steps,
  });
  function nodes(node) { return !node || typeof node !== 'object' ? [] : [node, ...[node.props?.children].flat(Infinity).flatMap(nodes)]; }
  const tree = Tutorial({ step: 0, readyRoute: true, getTarget: () => undefined });
  const all = nodes(tree);
  assert.ok(all.some(n => n.type === 'Text' && n.props.children === steps.TUTORIAL_STEPS[0].title));
  assert.ok(all.some(n => n.type === 'TourButton' && n.props.children === 'Next'));
  assert.equal(all.some(n => n.type === 'ScrollView'), false);
  const copy = all.filter(n => n.type === 'Text').map(n => n.props.children).join(' ');
  assert.doesNotMatch(copy, /still loading|follow you/);
});

test('icon cutouts preserve their centers near top and bottom safe areas', () => {
  for (const rect of [
    { x: 330, y: 40, width: 24, height: 24 },
    { x: 110, y: 780, width: 24, height: 24 },
    { x: 220, y: 780, width: 24, height: 24 },
  ]) {
    const layout = steps.spotlightLayout(rect, 390, 844, 48, 48);
    assert.ok(layout.hole);
    assert.equal(layout.hole.x + layout.hole.width / 2, rect.x + rect.width / 2);
    assert.equal(layout.hole.y + layout.hole.height / 2, rect.y + rect.height / 2);
    assert.ok(layout.hole.y <= rect.y);
    assert.ok(layout.hole.y + layout.hole.height >= rect.y + rect.height);
  }
});
test('calendar overview anchors below the calendar and legend', () => {
  const intro = steps.TUTORIAL_STEPS.find(step => step.route === '/calendar' && !step.target);
  assert.equal(intro.anchor, 'calendar-grid-and-legend');
  assert.equal(intro.placement, 'below');
  for (const grid of [{ x: 16, y: 100, width: 358, height: 350 }, { x: 16, y: 180, width: 358, height: 350 }]) {
    const note = steps.overviewLayout(grid, 390, 844, 24, 20, intro.placement);
    assert.equal(note.above, false);
    assert.ok(note.card.top > grid.y + grid.height);
  }
});

test('tab target measures the native button containing icon and label without adding a wrapper', () => {
  const jsx = (type, props) => ({ type, props });
  let target;
  const { HapticTab } = load('components/haptic-tab.tsx', {
    react: { useRef: value => ({ current: value }), useEffect: fn => fn() },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': {},
    'expo-router/react-navigation': { PlatformPressable: 'NativeTabButton' },
    'expo-haptics': {},
    '@/components/tutorial/guided-tour-provider': { useGuidedTour: () => ({ register: (_, value) => { target=value; return () => {}; } }) },
  });
  const children = ['icon', 'Explore'];
  const button = HapticTab({ tourId: 'tab-explore', children });
  assert.equal(button.type, 'NativeTabButton');
  assert.equal(button.props.children, children);
  button.props.ref.current = { measureInWindow: done => done(68, 838, 68, 52) };
  let measured;
  target.measure(value => { measured=value; });
  assert.equal(measured.height, 52);
  assert.equal(measured.width, 68);
  const hole = steps.spotlightLayout(measured, 406, 911, 48, 34).hole;
  assert.ok(hole.y + hole.height >= 890);
});
test('group target boundaries include the section title and calendar legend', () => {
  function targetSource(file, id) {
    const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let found;
    function visit(node) {
      if (ts.isJsxElement(node) && node.openingElement.tagName.getText(source) === 'TourTarget' && node.openingElement.attributes.properties.some(p => ts.isJsxAttribute(p) && p.name.getText(source) === 'id' && p.initializer?.text === id)) found = node.getText(source);
      ts.forEachChild(node, visit);
    }
    visit(source); return found;
  }
  const profile = targetSource('components/profile/UserProfile.tsx', 'profile-activities');
  assert.match(profile, /<SectionHeader/);
  assert.match(profile, /My Activities/);
  assert.match(profile, /<ActivitySegmentedControl/);
  const calendar = targetSource('app/calendar.tsx', 'calendar-grid-and-legend');
  assert.match(calendar, /<Calendar/);
  assert.match(calendar, /Your events/);
  assert.match(calendar, /Others&apos; events/);
});
