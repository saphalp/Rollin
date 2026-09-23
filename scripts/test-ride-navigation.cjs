const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const ts = require('typescript');
function compile(path, dependencies) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, require: () => dependencies, Deno: { serve() {} } });
  return exports;
}
const { googleMapsURL } = compile('services/ride-navigation-service.ts', {});
const { shortestPickupOrder } = compile('supabase/functions/ride-route/index.ts', {});
test('Google Maps opens from current location with ordered waypoints', () => {
  const url = new URL(googleMapsURL([{ latitude: 32, longitude: -92 }, { latitude: 33, longitude: -93 }, { latitude: 34, longitude: -94 }]));
  assert.equal(url.searchParams.get('origin'), null);
  assert.equal(url.searchParams.get('destination'), '34,-94');
  assert.equal(url.searchParams.get('waypoints'), '32,-92|33,-93');
});
test('long trips and next-stop navigation select only the next stop', () => {
  const stops = Array.from({ length: 5 }, (_, i) => ({ latitude: 32 + i, longitude: -92 }));
  for (const url of [new URL(googleMapsURL(stops)), new URL(googleMapsURL(stops.slice(0, 3), false))]) {
    assert.equal(url.searchParams.get('destination'), '32,-92');
    assert.equal(url.searchParams.get('waypoints'), null);
  }
  assert.throws(() => googleMapsURL([]));
});
test('pickup optimizer matches exhaustive search with asymmetric road distances', () => {
  const n = 5;
  const matrix = Array.from({ length: n + 2 }, (_, i) => Array.from({ length: n + 2 }, (_, j) => i === j ? 0 : ((i * 31 + j * 17) % 43) + 1));
  const cost = order => [0, ...order.map(i => i + 1), n + 1].reduce((sum, point, i, path) => i ? sum + matrix[path[i - 1]][point] : sum, 0);
  function permutations(values) { return values.length ? values.flatMap(v => permutations(values.filter(x => x !== v)).map(tail => [v, ...tail])) : [[]]; }
  assert.equal(cost(shortestPickupOrder(matrix, n)), Math.min(...permutations([0,1,2,3,4]).map(cost)));
  assert.throws(() => shortestPickupOrder([[0,null,null],[null,0,null],[null,null,0]], 1));
});
