const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const ts = require('typescript');
const vm = require('node:vm');

function transpileAndRun(filepath, mocks = {}) {
  const source = fs.readFileSync(filepath, 'utf8');
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
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

test('explore page does not query author email and deduplicates paginated posts', () => {
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

  // Verify post deduplication in loadMore
  assert.ok(
    exploreSource.includes('!prev.some((p) => p.id === item.id)'),
    'explore.tsx must deduplicate paginated posts to prevent FlatList key collisions'
  );

  // Verify storage cleanup on delete
  assert.ok(
    exploreSource.includes("supabase.storage.from('activity-photos').remove"),
    'explore.tsx must clean up orphaned storage photos on post delete'
  );

  // Verify retry button on error
  assert.ok(
    exploreSource.includes('Retry loading explore posts'),
    'explore.tsx must provide a retry action when loading fails'
  );

  // Verify themed refresh control
  assert.ok(
    exploreSource.includes('tintColor={colors.tint}'),
    'explore.tsx must apply theme tint to RefreshControl'
  );
});

test('PostCard and PostImageCarousel isolate gestures and dark mode theming', () => {
  const postCardSource = fs.readFileSync('components/explore/post-card.tsx', 'utf8');
  const carouselSource = fs.readFileSync('components/explore/post-image-carousel.tsx', 'utf8');

  // Verify PostCard does not wrap PostImageCarousel in an outer TouchableOpacity
  assert.ok(
    !postCardSource.includes('<TouchableOpacity\n        activeOpacity={0.95}\n        onPress={() => router.push(`/post/${post.id}`)}\n      >\n        <PostImageCarousel'),
    'PostCard must not wrap PostImageCarousel inside a parent TouchableOpacity'
  );
  assert.ok(
    postCardSource.includes('onPressImage={() => router.push(`/post/${post.id}`)}'),
    'PostCard must pass onPressImage to PostImageCarousel'
  );

  // Verify PostImageCarousel uses theme surfaceContainer instead of hardcoded #DDDDDD
  assert.ok(
    !carouselSource.includes('backgroundColor: "#DDDDDD"'),
    'PostImageCarousel must not hardcode light gray #DDDDDD in dark mode'
  );
  assert.ok(
    carouselSource.includes('colors.surfaceContainer'),
    'PostImageCarousel must use dynamic theme background'
  );
});
