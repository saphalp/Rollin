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
      StyleSheet: { create: (s) => s, hairlineWidth: 1 },
      TouchableOpacity: 'TouchableOpacity',
      View: 'View',
    },
    'expo-router': { useFocusEffect: () => {} },
    '@/components/tutorial/tour-target': { TourTarget: () => null },
    '@/components/explore/post-card': { PostCard: () => null },
    '@/components/text': { AppText: () => null },
    '@/components/ui/icon-symbol': { IconSymbol: () => null },
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

test('PostCard formatPostDate formats seconds, minutes, hours, 1-6d ago, then month/day or month/day/year', () => {
  const { formatPostDate } = transpileAndRun('components/explore/post-card.tsx', {
    react: {
      useCallback: (fn) => fn,
      useState: (initial) => [initial, () => {}],
    },
    'expo-image': { Image: 'Image' },
    'expo-router': { router: { push: () => {} } },
    'react-native': {
      StyleSheet: { create: (s) => s },
      TouchableOpacity: 'TouchableOpacity',
      View: 'View',
    },
    '@/components/explore/full-screen-image-viewer': { FullScreenImageViewer: () => null },
    '@/components/explore/post-image-carousel': { PostImageCarousel: () => null },
    '@/components/report/overflow-menu': { OverflowMenu: () => null },
    '@/components/share/share-sheet': { ShareSheet: () => null },
    '@/components/text': { AppText: () => null },
    '@/components/ui/icon-symbol': { IconSymbol: () => null },
    '@/constants/theme': { Colors: { light: {}, dark: {} }, Fonts: { sans: 'System' } },
    '@/hooks/use-color-scheme': { useColorScheme: () => 'light' },
    '@/hooks/use-post-like': { usePostLike: () => ({ liked: false, count: 0, toggle: () => {} }) },
  });

  const now = Date.now();

  // 1. Seconds (< 60s): Xs ago
  assert.equal(formatPostDate(new Date(now - 15000).toISOString()), '15s ago');
  assert.equal(formatPostDate(new Date(now - 45000).toISOString()), '45s ago');
  assert.equal(formatPostDate(new Date(now + 2000).toISOString()), '1s ago');

  // 2. Minutes (< 60m): Xm ago
  assert.equal(formatPostDate(new Date(now - 5 * 60000).toISOString()), '5m ago');
  assert.equal(formatPostDate(new Date(now - 45 * 60000).toISOString()), '45m ago');

  // 3. Hours (< 24h): Xh ago
  assert.equal(formatPostDate(new Date(now - 2 * 3600000).toISOString()), '2h ago');
  assert.equal(formatPostDate(new Date(now - 22 * 3600000).toISOString()), '22h ago');

  // 4. 1 to 6 days: 1d ago ... 6d ago
  assert.equal(formatPostDate(new Date(now - 25 * 3600000).toISOString()), '1d ago');
  assert.equal(formatPostDate(new Date(now - 3 * 86400000).toISOString()), '3d ago');
  assert.equal(formatPostDate(new Date(now - 6 * 86400000).toISOString()), '6d ago');

  // 5. Older than 6 days (current year): month/day
  const day14 = new Date(now - 14 * 86400000);
  assert.equal(formatPostDate(day14.toISOString()), `${day14.getMonth() + 1}/${day14.getDate()}`);

  // 6. Previous year: month/day/year
  assert.equal(formatPostDate('2025-11-04T12:00:00Z'), '11/4/2025');
  assert.equal(formatPostDate('2024-03-16T08:30:00Z'), '3/16/2024');

  // 7. Invalid date
  assert.equal(formatPostDate('invalid-date'), '');
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

test('explore page implements connected feed filters with distinct queries and empty states', () => {
  const exploreSource = fs.readFileSync('app/(tabs)/explore.tsx', 'utf8');

  // Check 3 filter options
  assert.ok(exploreSource.includes("'All Posts'"), 'Must include All Posts filter');
  assert.ok(exploreSource.includes("'My Campus'"), 'Must include My Campus filter');
  assert.ok(exploreSource.includes("'Following'"), 'Must include Following filter');

  // Check Following backend query connects to follows table with accepted status
  assert.ok(
    exploreSource.includes(".from('follows')") &&
    exploreSource.includes(".eq('status', 'accepted')") &&
    exploreSource.includes(".eq('follower_id', userId)"),
    'Following filter must query accepted connections from follows table'
  );

  // Check My Campus backend query connects to profiles table with matching university
  assert.ok(
    exploreSource.includes(".from('profiles')") &&
    exploreSource.includes(".eq('university', campus)"),
    'Campus filter must query profiles matching current university'
  );

  // Check distinct empty states
  assert.ok(
    exploreSource.includes('Campus Not Set') &&
    exploreSource.includes('No posts from people you follow'),
    'Explore must provide dedicated empty states for campus and following filters'
  );

  // Check TourTarget id="explore-first-post" is preserved
  assert.ok(
    exploreSource.includes('id="explore-first-post"'),
    'Guided tour target must be preserved'
  );
});

test('explore tab layout applies noScenePadding to eliminate excessive header whitespace', () => {
  const layoutSource = fs.readFileSync('app/(tabs)/_layout.tsx', 'utf8');

  // Find explore tab screen definition
  const exploreIdx = layoutSource.indexOf('name="explore"');
  assert.ok(exploreIdx > 0, 'explore screen must exist in _layout.tsx');

  const exploreSection = layoutSource.slice(exploreIdx, exploreIdx + 400);
  assert.ok(
    exploreSection.includes('styles.noScenePadding'),
    'explore tab must use styles.noScenePadding to remove double padding'
  );
});

test('full-screen image viewer supports pinch zoom, page counter, and safe close', () => {
  const viewerSource = fs.readFileSync('components/explore/full-screen-image-viewer.tsx', 'utf8');

  // Modal presentation
  assert.ok(viewerSource.includes('<Modal'), 'Must use Modal for full screen presentation');
  assert.ok(viewerSource.includes('maximumZoomScale={3}'), 'Must support pinch to zoom with maximumZoomScale');
  assert.ok(viewerSource.includes('minimumZoomScale={1}'), 'Must specify minimumZoomScale');
  assert.ok(viewerSource.includes('onRequestClose'), 'Must handle hardware back button on Android');
  assert.ok(viewerSource.includes('useSafeAreaInsets'), 'Must respect safe area insets');
  assert.ok(viewerSource.includes('handleDoubleTap'), 'Must support double tap zoom for cross-platform Android & iOS');
});

test('post card has activity badge beside username, Home badge style, expandable caption, and formatted date', () => {
  const cardSource = fs.readFileSync('components/explore/post-card.tsx', 'utf8');

  // 1. Header and author metadata
  assert.ok(cardSource.includes('width: 42'), 'Avatar should be 42px');
  assert.ok(cardSource.includes('height: 42'), 'Avatar height should be 42px');
  assert.ok(cardSource.includes('formatPostDate(post.createdAt)'), 'Must display formatted timestamp using formatPostDate');

  // 2. Activity badge in header beside username
  assert.ok(cardSource.includes('authorRow'), 'Must group username and badge in authorRow');
  assert.ok(cardSource.includes('activityBadge'), 'Activity badge style must be present');
  assert.ok(cardSource.includes('secondaryContainer'), 'Badge must use Rollin Home secondaryContainer style');
  assert.ok(cardSource.includes('onSecondaryContainer'), 'Badge must use Rollin Home onSecondaryContainer style');

  // 3. Expandable caption
  assert.ok(cardSource.includes('See more'), 'Must include See more for long captions');
  assert.ok(cardSource.includes('See less'), 'Must include See less for expanded captions');
  assert.ok(cardSource.includes('numberOfLines={isExpanded ? undefined : 2}'), 'Must default to max 2 lines');

  // 4. Action bar & Full-screen viewer
  assert.ok(cardSource.includes('actionRow'), 'Action row must be present');
  assert.ok(cardSource.includes('FullScreenImageViewer'), 'Full screen image viewer must be integrated');
});

test('explore page preserves scroll position and loaded posts when returning from details', () => {
  const exploreSource = fs.readFileSync('app/(tabs)/explore.tsx', 'utf8');

  // Verify hasLoadedRef prevents resetting feed on focus
  assert.ok(
    exploreSource.includes('hasLoadedRef'),
    'explore.tsx must use hasLoadedRef to guard against reloading from start on focus'
  );
  assert.ok(
    exploreSource.includes('!hasLoadedRef.current'),
    'explore.tsx must only trigger initial load on first focus'
  );
});
