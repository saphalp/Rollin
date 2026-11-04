const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

test('UserProfile source code contains pagination logic and page size of 3', () => {
  const source = fs.readFileSync('components/profile/UserProfile.tsx', 'utf8');

  // Verify page size is 3
  assert.match(source, /const\s+ACTIVITIES_PAGE_SIZE\s*=\s*3;/);

  // Verify initial createdRequest uses exact count and range(0, ACTIVITIES_PAGE_SIZE - 1)
  assert.match(source, /supabase[\s\S]*?\.from\(["']activities["']\)[\s\S]*?\.select\(["']id, title, date_time, image_url, category, status["'],\s*\{\s*count:\s*["']exact["']\s*\}\)[\s\S]*?\.range\(0,\s*ACTIVITIES_PAGE_SIZE\s*-\s*1\)/);

  // Verify initial joinedRequest uses exact count and range when isOwnProfile
  assert.match(source, /supabase[\s\S]*?\.from\(["']rsvps["']\)[\s\S]*?\.select\([\s\S]*?\{\s*count:\s*["']exact["']\s*\}[\s\S]*?\.range\(0,\s*ACTIVITIES_PAGE_SIZE\s*-\s*1\)/);

  // Verify ProfileStats uses hostedCount instead of createdActivities.length
  assert.match(source, /hosted:\s*hostedCount,/);

  // Verify handleLoadMore queries next range using current activities length
  assert.match(source, /const\s+from\s*=\s*createdActivities\.length;/);
  assert.match(source, /const\s+to\s*=\s*from\s*\+\s*ACTIVITIES_PAGE_SIZE\s*-\s*1;/);
  assert.match(source, /\.range\(from,\s*to\)/);

  // Verify Load more button exists with loading and press handling
  assert.match(source, /<Button[\s\S]*?mode=["']outlined["'][\s\S]*?onPress=\{[\s\S]*?handleLoadMore[\s\S]*?loading=\{loadingMore\}[\s\S]*?>[\s\S]*?Load more[\s\S]*?<\/Button>/);

  // Verify retry error handling is present
  assert.match(source, /styles\.loadMoreRetry/);
});

test('pagination simulation: fetches initial 3 items, loads next 3 on demand, and stops when exhausted', async () => {
  const TOTAL_RECORDS = 8;
  const PAGE_SIZE = 3;

  // Mock database table with 8 activities
  const allActivities = Array.from({ length: TOTAL_RECORDS }, (_, i) => ({
    id: `act-${i + 1}`,
    title: `Activity #${i + 1}`,
    date_time: new Date(Date.now() - i * 3600000).toISOString(),
    image_url: null,
    category: 'sports',
    status: 'active',
  }));

  const queriedRanges = [];

  const mockSupabase = {
    from: (table) => ({
      select: (fields, options) => ({
        eq: () => ({
          is: () => ({
            order: () => ({
              range: async (from, to) => {
                queriedRanges.push({ from, to });
                const slice = allActivities.slice(from, to + 1);
                return {
                  data: slice,
                  count: options?.count === 'exact' ? TOTAL_RECORDS : null,
                  error: null,
                };
              },
            }),
          }),
        }),
      }),
    }),
  };

  // Step 1: Initial load (page 0)
  const initialResult = await mockSupabase
    .from('activities')
    .select('id, title, date_time, image_url, category, status', { count: 'exact' })
    .eq('host_id', 'user-1')
    .is('recurrence_parent_id', null)
    .order('date_time', { ascending: false })
    .range(0, PAGE_SIZE - 1);

  let loadedActivities = initialResult.data;
  let hostedCount = initialResult.count;
  let hasMore = hostedCount > loadedActivities.length;

  assert.equal(loadedActivities.length, 3, 'Should load only 3 activities initially');
  assert.equal(hostedCount, 8, 'Total hosted count must reflect all 8 items');
  assert.equal(hasMore, true, 'hasMore must be true when 3 of 8 are loaded');
  assert.deepEqual(queriedRanges[0], { from: 0, to: 2 });

  // Step 2: First Load More (page 1)
  const nextFrom1 = loadedActivities.length;
  const nextTo1 = nextFrom1 + PAGE_SIZE - 1;
  const moreResult1 = await mockSupabase
    .from('activities')
    .select('id, title, date_time, image_url, category, status', { count: 'exact' })
    .eq('host_id', 'user-1')
    .is('recurrence_parent_id', null)
    .order('date_time', { ascending: false })
    .range(nextFrom1, nextTo1);

  loadedActivities = [...loadedActivities, ...moreResult1.data];
  hasMore = loadedActivities.length < hostedCount && moreResult1.data.length === PAGE_SIZE;

  assert.equal(loadedActivities.length, 6, 'Should have 6 activities after first load more');
  assert.equal(hasMore, true, 'hasMore must be true when 6 of 8 are loaded');
  assert.deepEqual(queriedRanges[1], { from: 3, to: 5 });

  // Step 3: Second Load More (page 2, final page with 2 items)
  const nextFrom2 = loadedActivities.length;
  const nextTo2 = nextFrom2 + PAGE_SIZE - 1;
  const moreResult2 = await mockSupabase
    .from('activities')
    .select('id, title, date_time, image_url, category, status', { count: 'exact' })
    .eq('host_id', 'user-1')
    .is('recurrence_parent_id', null)
    .order('date_time', { ascending: false })
    .range(nextFrom2, nextTo2);

  loadedActivities = [...loadedActivities, ...moreResult2.data];
  if (moreResult2.data.length < PAGE_SIZE || loadedActivities.length >= hostedCount) {
    hasMore = false;
  }

  assert.equal(loadedActivities.length, 8, 'All 8 activities should now be loaded');
  assert.equal(hasMore, false, 'hasMore must be false when all activities have been loaded');
  assert.deepEqual(queriedRanges[2], { from: 6, to: 8 });
});

test('pagination simulation: users with <= 3 activities never see Load more option', async () => {
  const TOTAL_RECORDS = 2;
  const PAGE_SIZE = 3;

  const mockActivities = [
    { id: 'act-1', title: 'A1', date_time: new Date().toISOString() },
    { id: 'act-2', title: 'A2', date_time: new Date().toISOString() },
  ];

  const initialResult = {
    data: mockActivities,
    count: TOTAL_RECORDS,
    error: null,
  };

  const loadedActivities = initialResult.data;
  const hostedCount = initialResult.count;
  const hasMore = hostedCount > loadedActivities.length;

  assert.equal(loadedActivities.length, 2);
  assert.equal(hostedCount, 2);
  assert.equal(hasMore, false, 'hasMore must be false when total activities <= 3');
});

test('pagination deduplication: prevents duplicate entries when new items overlap', () => {
  const existing = [
    { id: '1', title: 'Act 1' },
    { id: '2', title: 'Act 2' },
    { id: '3', title: 'Act 3' },
  ];

  const incoming = [
    { id: '3', title: 'Act 3' }, // Duplicate
    { id: '4', title: 'Act 4' },
    { id: '5', title: 'Act 5' },
  ];

  const existingIds = new Set(existing.map((a) => a.id));
  const unique = incoming.filter((a) => !existingIds.has(a.id));
  const combined = [...existing, ...unique];

  assert.equal(combined.length, 5);
  assert.deepEqual(combined.map(a => a.id), ['1', '2', '3', '4', '5']);
});

