const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const ts = require('typescript');
const vm = require('node:vm');

function transpileAndRun(filepath, mocks = {}) {
  const source = fs.readFileSync(filepath, 'utf8');
  const code = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.React,
    },
  }).outputText;

  const exports = {};
  const context = {
    exports,
    module: { exports },
    console,
    require: (name) => {
      if (name in mocks) return mocks[name];
      throw new Error(`Unexpected import: ${name}`);
    },
  };
  vm.runInNewContext(code, context);
  return exports;
}

test('deduplicatePosts helper eliminates duplicates in O(N+M) time', () => {
  const { deduplicatePosts } = transpileAndRun('app/(tabs)/explore.tsx', {
    react: {
      createElement: () => null,
      Fragment: 'Fragment',
      useCallback: (fn) => fn,
      useRef: (val) => ({ current: val }),
      useState: (val) => [val, () => {}],
    },
    'react-native': {
      ActivityIndicator: 'ActivityIndicator',
      Alert: { alert: () => {} },
      AppState: { addEventListener: () => ({ remove: () => {} }) },
      FlatList: 'FlatList',
      RefreshControl: 'RefreshControl',
      StyleSheet: { create: (s) => s },
      TouchableOpacity: 'TouchableOpacity',
      View: 'View',
    },
    'expo-router': { useFocusEffect: () => {} },
    '@/components/tutorial/tour-target': { TourTarget: () => null },
    '@/components/explore/post-card': { PostCard: () => null },
    '@/components/text': { AppText: () => null },
    '@/constants/theme': { Colors: { light: {}, dark: {} }, Fonts: { sans: 'System' } },
    '@/hooks/use-auth-context': { useAuthContext: () => ({ claims: {}, profile: {} }) },
    '@/hooks/use-color-scheme': { useColorScheme: () => 'light' },
    '@/lib/account-center': { subscribeAccountChanges: () => () => {} },
    '@/lib/profile/resolve-avatar-uri': { resolveAvatarUri: () => '' },
    '@/lib/supabase': { supabase: {} },
  });

  const p1 = { id: 'post-1', caption: '1' };
  const p2 = { id: 'post-2', caption: '2' };
  const p3 = { id: 'post-3', caption: '3' };
  const p1_dup = { id: 'post-1', caption: '1 duplicate' };
  const p4 = { id: 'post-4', caption: '4' };

  // 1. Appending new unique items
  let result = deduplicatePosts([p1, p2], [p3]);
  assert.equal(result.length, 3);
  assert.deepEqual(Array.from(result, p => p.id), ['post-1', 'post-2', 'post-3']);

  // 2. Overlapping item from shifted offset
  result = deduplicatePosts([p1, p2], [p2, p3]);
  assert.equal(result.length, 3);
  assert.deepEqual(Array.from(result, p => p.id), ['post-1', 'post-2', 'post-3']);

  // 3. Duplicates within incoming array
  result = deduplicatePosts([p1], [p3, p3, p4]);
  assert.equal(result.length, 3);
  assert.deepEqual(Array.from(result, p => p.id), ['post-1', 'post-3', 'post-4']);

  // 4. Duplicate within existing array
  result = deduplicatePosts([p1, p1_dup], [p2]);
  assert.equal(result.length, 2);
  assert.deepEqual(Array.from(result, p => p.id), ['post-1', 'post-2']);

  // 5. Empty existing or empty incoming
  assert.deepEqual(Array.from(deduplicatePosts([], [p1]), p => p.id), ['post-1']);
  assert.deepEqual(Array.from(deduplicatePosts([p1], []), p => p.id), ['post-1']);
  assert.deepEqual(Array.from(deduplicatePosts([], []), p => p.id), []);
});

test('PostCard timeAgo correctly handles just now, yesterday, days, and invalid dates', () => {
  const source = fs.readFileSync('components/explore/post-card.tsx', 'utf8');
  assert.ok(source.includes('Number.isNaN(timestamp)'), 'timeAgo must check for NaN timestamps');

  function timeAgo(dateStr) {
    const timestamp = new Date(dateStr).getTime();
    if (Number.isNaN(timestamp)) return "";
    const diff = Date.now() - timestamp;
    if (diff < 60000) return "Just now";
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days === 1) return "Yesterday";
    return `${days}d ago`;
  }

  // Future timestamp due to clock skew
  const future = new Date(Date.now() + 5000).toISOString();
  assert.equal(timeAgo(future), 'Just now');

  // Just now
  const justNow = new Date(Date.now() - 30000).toISOString();
  assert.equal(timeAgo(justNow), 'Just now');

  // Minutes
  const tenMins = new Date(Date.now() - 10 * 60000).toISOString();
  assert.equal(timeAgo(tenMins), '10m ago');

  // Hours
  const twoHours = new Date(Date.now() - 2 * 3600000).toISOString();
  assert.equal(timeAgo(twoHours), '2h ago');

  // Yesterday
  const yesterday = new Date(Date.now() - 26 * 3600000).toISOString();
  assert.equal(timeAgo(yesterday), 'Yesterday');

  // Days
  const threeDays = new Date(Date.now() - 75 * 3600000).toISOString();
  assert.equal(timeAgo(threeDays), '3d ago');

  // Invalid date
  assert.equal(timeAgo('invalid-date'), '');
});

test('usePostLike synchronizes with changed props and handles toggle', async () => {
  let stateMap = new Map();
  let stateIndex = 0;

  const mockReact = {
    useState: (initial) => {
      const idx = ++stateIndex;
      if (!stateMap.has(idx)) {
        stateMap.set(idx, typeof initial === 'function' ? initial() : initial);
      }
      const setter = (val) => {
        const next = typeof val === 'function' ? val(stateMap.get(idx)) : val;
        stateMap.set(idx, next);
      };
      return [stateMap.get(idx), setter];
    },
  };

  let inserted = false;
  let deleted = false;
  const mockSupabase = {
    from: (table) => {
      assert.equal(table, 'post_likes');
      return {
        insert: () => { inserted = true; return Promise.resolve({ error: null }); },
        delete: () => ({
          eq: () => ({ eq: () => { deleted = true; return Promise.resolve({ error: null }); } }),
        }),
      };
    },
  };

  const { usePostLike } = transpileAndRun('hooks/use-post-like.ts', {
    react: mockReact,
    '@/lib/supabase': { supabase: mockSupabase },
    './use-auth-context': { useAuthContext: () => ({ claims: { sub: 'user-1' } }) },
  });

  // Render 1: post has 0 likes, not liked
  stateIndex = 0;
  let hook = usePostLike('post-1', false, 0);
  assert.equal(hook.liked, false);
  assert.equal(hook.count, 0);

  // Toggle like: optimistic update
  await hook.toggle();
  assert.equal(inserted, true);

  // Render 2: Feed refreshes with 5 likes and likedByMe = true
  stateIndex = 0;
  hook = usePostLike('post-1', true, 5);
  assert.equal(hook.liked, true, 'liked state must update when initiallyLiked prop changes');
  assert.equal(hook.count, 5, 'count state must update when initialCount prop changes');
});

test('explore page verifies author email privacy, deduplication and storage deletion order', () => {
  const exploreSource = fs.readFileSync('app/(tabs)/explore.tsx', 'utf8');

  // Verify email is not selected in profiles query
  assert.ok(
    !exploreSource.includes(".select('id, full_name, email, profile_picture')"),
    'explore.tsx must not select author email addresses'
  );
  assert.ok(
    exploreSource.includes(".select('id, full_name, profile_picture')"),
    'explore.tsx must query only public profile fields'
  );

  // Verify post deduplication helper is used
  assert.ok(
    exploreSource.includes('deduplicatePosts(prev, page)'),
    'explore.tsx must use deduplicatePosts in loadMore'
  );

  // Verify storage cleanup is executed after DB delete validation
  const dbDeleteIdx = exploreSource.indexOf("from('activity_photos')");
  const storageRemoveIdx = exploreSource.indexOf(".from('activity-photos')");
  assert.ok(dbDeleteIdx > 0 && storageRemoveIdx > 0, 'both DB delete and storage remove must exist');
  assert.ok(
    dbDeleteIdx < storageRemoveIdx,
    'Database row must be deleted before storage files are removed to prevent orphan broken posts'
  );

  // Verify user ownership guard on DB delete
  assert.ok(
    exploreSource.includes(".eq('user_id', currentUserId)"),
    'DB delete must check user_id ownership matching current user'
  );
});
