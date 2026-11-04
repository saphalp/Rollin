const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const ts = require('typescript');

function compile(path, dependencies) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, require: name => {
    if (!(name in dependencies)) throw Error(name);
    return dependencies[name];
  }, console });
  return exports;
}

// Records every query call; returns `rows` (sliced by range) when awaited.
function fakeSupabase(rows) {
  const calls = [];
  const query = {
    then(resolve) {
      const range = calls.find(c => c[0] === 'range');
      const data = range ? rows.slice(range[1], range[2] + 1) : rows;
      resolve({ data, error: null });
    },
  };
  for (const method of ['select', 'eq', 'order', 'or', 'not', 'gt', 'limit', 'range']) {
    query[method] = (...args) => { calls.push([method, ...args]); return query; };
  }
  return { supabase: { from: () => query }, calls };
}

const row = n => ({ id: `a${n}`, title: `Activity ${n}`, category: 'social', date_time: null, rsvps: [] });
const context = (overrides = {}) => ({
  visibleHostIds: [], category: 'All', search: '', positions: new Map(), featuredIds: [], ...overrides,
});

test('the first page has 8 activities and knows there are more', async () => {
  const { supabase, calls } = fakeSupabase(Array.from({ length: 20 }, (_, i) => row(i)));
  const { fetchListPage, PAGE_SIZE } = compile('lib/home-activity-feed.ts', { '@/lib/supabase': { supabase }, '@/lib/profile/resolve-avatar-uri': { resolveAvatarUri: path => path } });

  assert.equal(PAGE_SIZE, 8);
  const page = await fetchListPage(context(), 0, PAGE_SIZE);
  assert.equal(page.activities.length, 8);
  assert.equal(page.hasMore, true);
  assert.deepEqual(calls.find(c => c[0] === 'range'), ['range', 0, 8], 'asks for one extra row to detect more');
});

test('the last page reports no more', async () => {
  const { supabase } = fakeSupabase(Array.from({ length: 10 }, (_, i) => row(i)));
  const { fetchListPage } = compile('lib/home-activity-feed.ts', { '@/lib/supabase': { supabase }, '@/lib/profile/resolve-avatar-uri': { resolveAvatarUri: path => path } });

  const page = await fetchListPage(context(), 8, 8);
  assert.deepEqual(page.activities.map(a => a.id), ['a8', 'a9']);
  assert.equal(page.hasMore, false);
});

test('featured activities are left out of the list, and search and category go to the server', async () => {
  const { supabase, calls } = fakeSupabase([]);
  const { fetchListPage } = compile('lib/home-activity-feed.ts', { '@/lib/supabase': { supabase }, '@/lib/profile/resolve-avatar-uri': { resolveAvatarUri: path => path } });

  await fetchListPage(context({ featuredIds: ['f1', 'f2'], category: 'Sports', search: 'pick,le(ball)%' }), 0, 8);
  assert.ok(calls.some(c => c[0] === 'not' && c[1] === 'id' && c[2] === 'in' && c[3] === '(f1,f2)'));
  assert.ok(calls.some(c => c[0] === 'eq' && c[1] === 'category' && c[2] === 'sports'));
  const search = calls.find(c => c[0] === 'or' && c[1].startsWith('title.ilike'));
  assert.ok(search, 'search filters title or location');
  assert.ok(!/[(),]/.test(search[1].replace('title.ilike.', '').replace(',location.ilike.', '').replace(/%/g, '')),
    'characters that would break the filter are stripped');
});

test('a guest only sees public activities; a signed-in user also sees private ones they can access', async () => {
  const guest = fakeSupabase([]);
  compile('lib/home-activity-feed.ts', { '@/lib/supabase': { supabase: guest.supabase }, '@/lib/profile/resolve-avatar-uri': { resolveAvatarUri: path => path } }).buildActivityQuery(context());
  assert.ok(guest.calls.some(c => c[0] === 'eq' && c[1] === 'event_type' && c[2] === 'public'));

  const member = fakeSupabase([]);
  compile('lib/home-activity-feed.ts', { '@/lib/supabase': { supabase: member.supabase }, '@/lib/profile/resolve-avatar-uri': { resolveAvatarUri: path => path } })
    .buildActivityQuery(context({ visibleHostIds: ['me', 'friend'] }));
  assert.ok(member.calls.some(c => c[0] === 'or' && c[1].includes('host_id.in.(me,friend)')));
});

test('each activity carries its host\'s name and photo, or no host when the profile is hidden', async () => {
  const { supabase, calls } = fakeSupabase([
    { ...row(1), host: { full_name: ' Dana Host ', profile_picture: 'dana.jpg' } },
    { ...row(2), host: null },
  ]);
  const { fetchListPage } = compile('lib/home-activity-feed.ts', {
    '@/lib/supabase': { supabase },
    '@/lib/profile/resolve-avatar-uri': { resolveAvatarUri: path => `avatars/${path}` },
  });

  const page = await fetchListPage(context(), 0, 8);
  assert.ok(calls.find(c => c[0] === 'select')[1].includes('host:profiles!host_id(full_name, profile_picture)'));
  assert.deepEqual(page.activities.map(a => [a.hostName, a.hostAvatarUrl]), [['Dana Host', 'avatars/dana.jpg'], [undefined, undefined]]);
});
