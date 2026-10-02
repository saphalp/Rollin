// Run with: node --test scripts/test-signup-verification.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const ts = require('typescript');

function mount(file, auth, params = { email: ' Student@Example.com ' }, props = {}) {
  const states = [], refs = [], routes = [];
  let cursor = 0, refCursor = 0;
  const exports = {};
  const jsx = (type, props) => ({ type, props });
  const native = new Proxy({
    StyleSheet: { create: value => value }, Platform: { OS: 'android' },
    useColorScheme: () => 'light', Alert: { alert() {} },
  }, { get: (target, name) => target[name] ?? name });
  const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(compiled, {
    exports, console, setTimeout, clearTimeout,
    require(name) {
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
      if (name === 'react') return {
        useState(initial) {
          const i = cursor++;
          if (!(i in states)) states[i] = initial;
          return [states[i], value => { states[i] = typeof value === 'function' ? value(states[i]) : value; }];
        },
        useRef(initial) { const i = refCursor++; return refs[i] ??= { current: initial }; },
        useEffect() {},
      };
      if (name === 'react-native') return native;
      if (name === 'react-native-paper') return { Button: 'Button', Text: 'Text', TextInput: Object.assign(() => {}, { Icon: 'Icon' }) };
      if (name === 'react-native-safe-area-context') return { SafeAreaView: 'SafeAreaView' };
      if (name === 'react-native-svg') return { __esModule: true, default: 'Svg', Path: 'Path', Rect: 'Rect' };
      if (name === 'expo-router') return { Redirect: 'Redirect', useLocalSearchParams: () => params, router: { replace: route => routes.push(route) } };
      if (name === '@/lib/supabase') return { supabase: { auth } };
      if (name === '@/constants/theme') return { Colors: { light: {} }, Fonts: {} };
      if (name === './SignInWithGoogle') return { __esModule: true, default: 'GoogleSignIn' };
      throw Error(name);
    },
  });
  function render() { cursor = 0; refCursor = 0; return exports.default(props); }
  function nodes(node = render()) {
    if (!node || typeof node !== 'object') return [];
    return [node, ...[node.props?.children].flat(Infinity).flatMap(child => nodes(child ?? null))];
  }
  return {
    render, routes,
    input: label => nodes().find(node => node.props?.label === label || node.props?.placeholder === label),
    button: label => nodes().find(node => node.type === 'Button' && node.props.children === label),
    text: () => nodes().filter(node => node.type === 'Text').map(node => node.props.children).flat().join(' '),
  };
}
const screen = 'app/(auth)/EmailConfirmation.tsx';

test('signup code validation and successful verification use email OTP without signing out', async () => {
  const calls = [];
  const app = mount(screen, { verifyOtp: async args => { calls.push(args); return { data: { session: {} }, error: null }; } });
  app.input('Verification code').props.onChangeText('abc');
  await app.button('Verify code').props.onPress();
  assert.equal(calls.length, 0);
  assert.match(app.text(), /numeric code/);
  app.input('Verification code').props.onChangeText('01234567');
  await app.button('Verify code').props.onPress();
  assert.equal(calls[0].email, 'student@example.com');
  assert.equal(calls[0].token, '01234567');
  assert.equal(calls[0].type, 'email');
  assert.match(app.text(), /Email verified/);
});

test('expired codes and network errors keep verification available', async () => {
  for (const verifyOtp of [
    async () => ({ data: {}, error: { status: 403 } }),
    async () => { throw Error('offline'); },
  ]) {
    const app = mount(screen, { verifyOtp });
    app.input('Verification code').props.onChangeText('123456');
    await app.button('Verify code').props.onPress();
    assert.match(app.text(), /invalid or expired|connection/);
    assert.equal(app.button('Verify code').props.disabled, false);
    assert.equal(app.routes.length, 0);
  }
});

test('resend uses signup email and prevents repeated requests during cooldown', async () => {
  const calls = [];
  const app = mount(screen, { resend: async args => { calls.push(args); return { error: null }; } });
  await app.button('Resend code').props.onPress();
  const resend = app.button('Resend in 60s');
  assert.equal(resend.props.disabled, true);
  await resend.props.onPress();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].type, 'signup');
  assert.equal(calls[0].email, 'student@example.com');
});

test('rate-limited resends display a wait message and cooldown', async () => {
  const app = mount(screen, { resend: async () => ({ error: { status: 429 } }) });
  await app.button('Resend code').props.onPress();
  assert.match(app.text(), /Please wait/);
  assert.equal(app.button('Resend in 60s').props.disabled, true);
});

test('duplicate verification presses cannot submit simultaneous requests', async () => {
  let finish, count = 0;
  const app = mount(screen, { verifyOtp: () => { count++; return new Promise(resolve => { finish = resolve; }); } });
  app.input('Verification code').props.onChangeText('123456');
  const verify = app.button('Verify code').props.onPress;
  const first = verify();
  await verify();
  assert.equal(count, 1);
  assert.equal(app.button('Resend code').props.disabled, true);
  finish({ data: { session: {} }, error: null });
  await first;
});

test('missing email returns to auth and Back to login selects login mode', () => {
  assert.equal(mount(screen, {}, {}).render().type, 'Redirect');
  const app = mount(screen, {});
  app.button('Back to login').props.onPress();
  assert.equal(app.routes[0].params.mode, 'login');
});

test('unconfirmed login routes to verification with normalized email', async () => {
  const app = mount('components/auth/login.tsx', { signInWithPassword: async () => ({ data: {}, error: { code: 'email_not_confirmed' } }) });
  app.input('Email').props.onChangeText(' Student@Example.com ');
  app.input('Password').props.onChangeText('password1');
  await app.button('Log In').props.onPress();
  assert.equal(app.routes[0].pathname, '/(auth)/EmailConfirmation');
  assert.equal(app.routes[0].params.email, 'student@example.com');
});

test('signup passes email to verification and does not navigate there for an existing session', async () => {
  for (const session of [null, {}]) {
    const app = mount('components/auth/PasswordCard.tsx', { signUp: async () => ({ data: { user: {}, session }, error: null }) }, {}, { email: ' Student@Example.com ' });
    app.input('Password').props.onChangeText('password1');
    app.input('Confirm password').props.onChangeText('password1');
    await app.button('Sign Up').props.onPress();
    if (session) assert.equal(app.routes.length, 0);
    else assert.equal(app.routes[0].params.email, 'student@example.com');
  }
});
