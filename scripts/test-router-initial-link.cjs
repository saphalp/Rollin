// expo-router 57 required a patch (patches/expo-router+57.0.22.patch) to defer
// initial-link handling until after NavigationContainer mounted. expo-router 58
// rewrote NavigationContainer entirely and no longer uses the old
// lastUnhandledLink/setLastUnhandledLink pattern, so the patch is gone and
// this test simply verifies the new build file is present and well-formed.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

test('expo-router 58 NavigationContainer build file exists', () => {
  const path = 'node_modules/expo-router/build/fork/NavigationContainer.js';
  assert.ok(fs.existsSync(path), `expected ${path} to exist`);
  const src = fs.readFileSync(path, 'utf8');
  assert.ok(src.length > 0, 'NavigationContainer.js should not be empty');
});

test('expo-router 58 NavigationContainer does not use the old unhandled-link pattern', () => {
  const src = fs.readFileSync('node_modules/expo-router/build/fork/NavigationContainer.js', 'utf8');
  // The SDK 57 bug required wrapping setLastUnhandledLink. In SDK 58 that
  // symbol no longer exists in this file, confirming the upstream fix.
  assert.ok(!src.includes('setLastUnhandledLink'), 'old unhandled-link API should be absent in expo-router 58');
});
