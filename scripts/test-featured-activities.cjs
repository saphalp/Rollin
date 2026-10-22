const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const ts = require('typescript');

function load(file, mocks = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, { exports, Map, Number, console, require: name => {
    if (!(name in mocks)) throw Error(`Missing mock: ${name}`);
    return mocks[name];
  } });
  return exports;
}

let rpcResult = { data: [], error: null };
const rpcCalls = [];
const supabase = { rpc: async (name, args) => { rpcCalls.push([name, args]); return rpcResult; } };
const { rankFeatured, fetchFeaturedScores } = load('lib/featured-activities.ts', { '@/lib/supabase': { supabase } });

const activity = (id, sortKey = '2026-10-21', attendeeCount = 0, maxAttendees = 10) => ({ id, sortKey, attendeeCount, maxAttendees });
const ids = rows => Array.from(rows, row => row.id);

test('ranks by score, highest first, top 3 only', () => {
  const scores = new Map([['a', { score: 1, isFull: false }], ['b', { score: 9, isFull: false }], ['c', { score: 5, isFull: false }], ['d', { score: 7, isFull: false }]]);
  assert.deepEqual(ids(rankFeatured([activity('a'), activity('b'), activity('c'), activity('d')], scores)), ['b', 'd', 'c']);
});

test('full activities rank after every open one, regardless of score', () => {
  const scores = new Map([['full', { score: 100, isFull: true }], ['open1', { score: 1, isFull: false }], ['open2', { score: 0, isFull: false }]]);
  assert.deepEqual(ids(rankFeatured([activity('full'), activity('open1'), activity('open2')], scores)), ['open1', 'open2', 'full']);
  assert.deepEqual(ids(rankFeatured([activity('full'), activity('open1')], scores, 1)), ['open1']);
});

test('ties go to the sooner activity; missing scores fall back to client capacity and date', () => {
  const rows = [activity('later', '2026-10-25'), activity('full-soon', '2026-10-21', 10, 10), activity('soon', '2026-10-22')];
  assert.deepEqual(ids(rankFeatured(rows, new Map())), ['soon', 'later', 'full-soon']);
});

test('does not mutate the input order', () => {
  const rows = [activity('a', '2026-10-25'), activity('b', '2026-10-21')];
  rankFeatured(rows, new Map());
  assert.deepEqual(ids(rows), ['a', 'b']);
});

test('fetchFeaturedScores maps rows, skips empty input, and returns empty map on error', async () => {
  assert.equal((await fetchFeaturedScores([])).size, 0);
  assert.equal(rpcCalls.length, 0);

  rpcResult = { data: [{ activity_id: 'a', score: '12.5', is_full: false }], error: null };
  const scores = await fetchFeaturedScores(['a']);
  assert.equal(JSON.stringify(rpcCalls.at(-1)), JSON.stringify(['featured_activity_scores', { p_activity_ids: ['a'] }]));
  assert.deepEqual({ ...scores.get('a') }, { score: 12.5, isFull: false });

  rpcResult = { data: null, error: { message: 'function does not exist' } };
  const original = console.error;
  console.error = () => {};
  try { assert.equal((await fetchFeaturedScores(['a'])).size, 0); } finally { console.error = original; }
});
