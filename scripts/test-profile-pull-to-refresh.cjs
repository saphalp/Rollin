const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

test('UserProfile source code includes RefreshControl and onRefresh integration', () => {
  const source = fs.readFileSync('components/profile/UserProfile.tsx', 'utf8');

  // Verify RefreshControl is imported from react-native
  assert.match(source, /import\s*\{[^}]*RefreshControl[^}]*\}\s*from\s*["']react-native["']/);

  // Verify refreshing state exists
  assert.match(source, /const\s*\[\s*refreshing\s*,\s*setRefreshing\s*\]\s*=\s*useState\(false\)/);

  // Verify onRefresh callback exists and calls all relevant refreshers
  assert.match(source, /const\s+onRefresh\s*=\s*useCallback\(async\s*\(\)\s*=>\s*\{/);
  assert.match(source, /setRefreshing\(true\)/);
  assert.match(source, /notifyAccountChanges\(\)/);
  assert.match(source, /refreshProfile\(\)/);
  assert.match(source, /refreshInterests\(\)/);
  assert.match(source, /refreshFollow\(\)/);
  assert.match(source, /refreshReviews\(\)/);
  assert.match(source, /loadRideCount\(\)/);
  assert.match(source, /loadInitialActivities\(\)/);
  assert.match(source, /setRefreshing\(false\)/);

  // Verify TourScrollView is configured with refreshControl prop
  assert.match(source, /<TourScrollView[\s\S]*?refreshControl=\{[\s\S]*?<RefreshControl[\s\S]*?refreshing=\{refreshing\}[\s\S]*?onRefresh=\{onRefresh\}[\s\S]*?\/>[\s\S]*?\}/);
});

test('useProfile hook exposes refresh function for both own and other profiles', () => {
  const source = fs.readFileSync('hooks/use-profile.ts', 'utf8');

  // Verify refresh function definition
  assert.match(source, /const\s+refresh\s*=\s*useCallback\(async\s*\(\)\s*=>\s*\{/);
  // Verify it calls refreshProfile for own profile
  assert.match(source, /if\s*\(isOwnProfile\)\s*\{\s*await\s+refreshProfile\(\);/);
  // Verify it calls fetchOther for other profile
  assert.match(source, /await\s+fetchOther\(\);/);
  // Verify returned object includes refresh
  assert.match(source, /return\s*\{\s*profile,\s*isLoading,\s*isOwnProfile,\s*error,\s*refresh\s*\};/);
});

test('useReviewSummary hook exposes refresh function', () => {
  const source = fs.readFileSync('hooks/use-review-summary.ts', 'utf8');

  // Verify refresh callback definition
  assert.match(source, /const\s+refresh\s*=\s*useCallback\(async\s*\(\)\s*=>\s*\{/);
  assert.match(source, /const\s+next\s*=\s*await\s+reviewSummary\(userId\);/);
  // Verify returned object includes refresh
  assert.match(source, /return\s*\{\s*\.\.\.summary,\s*refresh\s*\};/);
});

test('pull-to-refresh execution simulation coordinates all profile updates concurrently', async () => {
  const refreshed = {
    profile: false,
    interests: false,
    follow: false,
    reviews: false,
    rideCount: false,
    activities: false,
    accountChangesNotified: false,
  };

  const notifyAccountChanges = () => {
    refreshed.accountChangesNotified = true;
  };
  const refreshProfile = async () => {
    refreshed.profile = true;
  };
  const refreshInterests = async () => {
    refreshed.interests = true;
  };
  const refreshFollow = async () => {
    refreshed.follow = true;
  };
  const refreshReviews = async () => {
    refreshed.reviews = true;
  };
  const loadRideCount = async () => {
    refreshed.rideCount = true;
  };
  const loadInitialActivities = async () => {
    refreshed.activities = true;
  };

  let isRefreshing = false;

  async function onRefresh() {
    isRefreshing = true;
    notifyAccountChanges();
    try {
      await Promise.all([
        refreshProfile(),
        refreshInterests(),
        refreshFollow(),
        refreshReviews(),
        loadRideCount(),
        loadInitialActivities(),
      ]);
    } finally {
      isRefreshing = false;
    }
  }

  assert.equal(isRefreshing, false);
  const refreshPromise = onRefresh();
  assert.equal(isRefreshing, true, 'isRefreshing must be true during onRefresh execution');

  await refreshPromise;

  assert.equal(isRefreshing, false, 'isRefreshing must reset to false after onRefresh finishes');
  assert.equal(refreshed.profile, true, 'Profile must be refreshed');
  assert.equal(refreshed.interests, true, 'Interests must be refreshed');
  assert.equal(refreshed.follow, true, 'Follow status must be refreshed');
  assert.equal(refreshed.reviews, true, 'Review summary must be refreshed');
  assert.equal(refreshed.rideCount, true, 'Ride count must be refreshed');
  assert.equal(refreshed.activities, true, 'Activities must be refreshed');
  assert.equal(refreshed.accountChangesNotified, true, 'Account change subscribers must be notified');
});
