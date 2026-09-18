// Exercise the actual installed workaround without a native renderer.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');

function setup(currentPath) {
  const source = fs.readFileSync(require.resolve('expo-router/build/fork/NavigationContainer'), 'utf8');
  const start = source.indexOf('    // Rollin: defer initial-link updates');
  const end = source.indexOf('    const { getInitialState }', start);
  assert.ok(start >= 0 && end > start, 'Expo Router patch must be installed');
  let effect;
  const updates = [];
  const context = {
    react_1: { default: {
      useRef: (value) => ({ current: value }),
      useCallback: (callback) => callback,
      useEffect: (callback) => { effect = callback; },
    } },
    refContainer: { current: { getCurrentRoute: () => ({ path: currentPath }) } },
    setLastUnhandledLink: (value) => updates.push(value),
  };
  vm.createContext(context);
  vm.runInContext(source.slice(start, end) + '\nglobalThis.handle = onUnhandledLinking;', context);
  return { handle: context.handle, mount: () => effect(), updates };
}

test('initial-link promise resolves before commit without updating state', async () => {
  const app = setup('/');
  await Promise.resolve('/ride/123').then(app.handle);
  assert.deepEqual(app.updates, []);
  const unmount = app.mount();
  assert.deepEqual(app.updates, ['/ride/123']);
  app.handle('/profile/456');
  assert.deepEqual(app.updates, ['/ride/123', '/profile/456']);
  unmount();
  app.handle('/late');
  assert.equal(app.updates.length, 2);
});
test('does not restore an initial link already handled by child onReady', () => {
  const app = setup('/ride/123');
  app.handle('/ride/123');
  app.mount();
  assert.deepEqual(app.updates, []);
});
