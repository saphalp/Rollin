const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const ts = require('typescript');

const code = ts.transpileModule(fs.readFileSync('services/ride-notifications-service.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function load(environment, granted = true) {
  const calls = [];
  const exports = {};
  vm.runInNewContext(code, {
    exports,
    require(name) {
      if (name === 'expo-constants') return {
        __esModule: true,
        default: { executionEnvironment: environment },
        ExecutionEnvironment: { StoreClient: 'storeClient' },
      };
      if (name === 'react-native') return {
        Platform: { OS: 'android' }, Alert: { alert: () => calls.push('alert') },
      };
      if (name === 'expo-notifications') {
        calls.push('import');
        if (environment === 'storeClient') throw new Error('Unsupported Expo Go import');
        return {
          setNotificationHandler() {}, AndroidImportance: { HIGH: 4 },
          setNotificationChannelAsync: async () => calls.push('channel'),
          getPermissionsAsync: async () => ({ granted }),
          requestPermissionsAsync: async () => ({ granted }),
          scheduleNotificationAsync: async () => calls.push('schedule'),
        };
      }
      throw new Error(`Unexpected import: ${name}`);
    },
  });
  return { calls, service: exports };
}

test('Expo Go can import the service and show arrival without loading push registration', async () => {
  const { calls, service } = load('storeClient');
  await service.configureRideNotifications();
  await service.notifyDriverArrived();
  assert.deepEqual(calls, ['alert']);
});
test('development builds keep native arrival notifications', async () => {
  const { calls, service } = load('bare');
  assert.deepEqual(calls, []);
  await service.notifyDriverArrived();
  assert.ok(calls.includes('channel'));
  assert.ok(calls.includes('schedule'));
});
test('denied permission does not schedule a notification', async () => {
  const { calls, service } = load('bare', false);
  await service.notifyDriverArrived();
  assert.ok(!calls.includes('schedule'));
});
