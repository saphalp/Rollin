import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, RefreshControl, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';

import { ActivityCard } from '@/components/activity-card';
import { FeaturedCarousel } from '@/components/home/featured-carousel';
import { StandaloneRidesSection } from '@/components/rides/standalone-rides-section';
import { AppText } from '@/components/text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { AppView } from '@/components/view';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { fetchFeaturedScores, rankFeatured } from '@/lib/featured-activities';
import {
  buildActivityQuery,
  FEATURED_CANDIDATES,
  fetchListPage,
  PAGE_SIZE,
  toActivity,
  type Activity,
  type FeedContext,
} from '@/lib/home-activity-feed';
import { supabase } from '@/lib/supabase';

const CATEGORIES = ['All', 'Social', 'Sports', 'Music', 'Study', 'Outdoor', 'Gaming'];

export default function HomeScreen() {
  const theme = useColorScheme() ?? 'light';
  const colors = Colors[theme];
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [activities, setActivities] = useState<Activity[]>([]);
  const [featured, setFeatured] = useState<Activity[]>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [feedError, setFeedError] = useState('');
  const generation = useRef(0);
  // What the current list was loaded with, so Load more can fetch the next page of it.
  const feedContext = useRef<FeedContext | null>(null);
  // How many list activities are shown, so a background refresh keeps them all.
  const loadedCount = useRef(PAGE_SIZE);
  const listKey = useRef('');

  // Search runs on the server, so wait until typing pauses.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchActivities = useCallback(async () => {
    const request = ++generation.current;
    const current = () => request === generation.current;
    // A new category or search starts again from the first page.
    const key = `${selectedCategory}|${debouncedSearch}`;
    if (key !== listKey.current) {
      listKey.current = key;
      loadedCount.current = PAGE_SIZE;
    }
    setLoading(true);
    setFeedError('');
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (!current()) return;
      if (authError) throw authError;
      const visibleHostIds = user ? [user.id] : [];
      if (user) {
        const [saved, followed] = await Promise.all([
          supabase.from('saved_activities').select('activity_id').eq('user_id', user.id),
          supabase.from('follows').select('following_id').eq('follower_id', user.id).eq('status', 'accepted'),
        ]);
        if (!current()) return;
        if (followed.error) throw followed.error;
        visibleHostIds.push(...(followed.data ?? []).map(f => f.following_id));
        if (!saved.error) setSavedIds(new Set((saved.data ?? []).map(r => r.activity_id)));
      } else {
        setSavedIds(new Set());
      }
      const { data: spots } = await supabase.rpc('my_waitlist_positions');
      const positions = new Map<string, number>(
        (spots ?? []).map((s: any) => [s.activity_id, s.position_in_line]),
      );
      const context: FeedContext = {
        visibleHostIds, category: selectedCategory, search: debouncedSearch, positions, featuredIds: [],
      };

      // Featured: the best-scoring of the soonest upcoming activities.
      const candidates = await buildActivityQuery(context)
        .gt('date_time', new Date().toISOString())
        .limit(FEATURED_CANDIDATES);
      if (!current()) return;
      if (candidates.error) throw candidates.error;
      const candidateActivities = (candidates.data ?? []).map(row => toActivity(row, positions));
      const scores = await fetchFeaturedScores(candidateActivities.map(a => a.id));
      if (!current()) return;
      const nextFeatured = rankFeatured(candidateActivities, scores);
      context.featuredIds = nextFeatured.map(a => a.id);

      // The list: everything else, one page (or as many as were already loaded) at a time.
      const count = Math.max(PAGE_SIZE, loadedCount.current);
      const page = await fetchListPage(context, 0, count);
      if (!current()) return;

      feedContext.current = context;
      loadedCount.current = page.activities.length;
      setFeatured(nextFeatured);
      setActivities(page.activities);
      setHasMore(page.hasMore);
    } catch {
      if (current()) {
        setActivities([]); setFeatured([]); setSavedIds(new Set()); setHasMore(false);
        setFeedError('Unable to load Home. Pull down to retry.');
      }
    } finally { if (current()) setLoading(false); }
  }, [selectedCategory, debouncedSearch]);

  async function loadMore() {
    const context = feedContext.current;
    if (!context || loadingMore || !hasMore) return;
    const request = generation.current;
    setLoadingMore(true);
    try {
      const page = await fetchListPage(context, activities.length, PAGE_SIZE);
      // Drop the page if the list was reloaded (new category, search, or refresh) meanwhile.
      if (request !== generation.current) return;
      const seen = new Set(activities.map(a => a.id));
      const next = [...activities, ...page.activities.filter(a => !seen.has(a.id))];
      loadedCount.current = next.length;
      setActivities(next);
      setHasMore(page.hasMore);
    } catch {
      if (request === generation.current) setFeedError('Could not load more activities. Try again.');
    } finally {
      setLoadingMore(false);
    }
  }

  useFocusEffect(useCallback(() => { void fetchActivities(); }, [fetchActivities]));
  useEffect(() => {
    let active = true;
    let accountKey: string | undefined;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextKey = `${session?.user.id ?? ''}:${session?.user.email ?? ''}:${session?.user.email_confirmed_at ?? ''}`;
      if (nextKey === accountKey) return;
      accountKey = nextKey;
      ++generation.current;
      setActivities([]); setFeatured([]); setSavedIds(new Set());
      setTimeout(() => { if (active) void fetchActivities(); }, 0);
    });
    const foreground = AppState.addEventListener('change', state => {
      if (state === 'active') void fetchActivities();
    });
    const refresh = setInterval(() => {
      if (AppState.currentState === 'active') void fetchActivities();
    }, 5 * 60_000);
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      active = false; ++generation.current; subscription.unsubscribe();
      foreground.remove(); clearInterval(refresh);
    };
  }, [fetchActivities]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await fetchActivities(); } finally { setRefreshing(false); }
  }, [fetchActivities]);

  function openActivity(activity: { id: string }) {
    router.push(`/activity/${activity.id}`);
  }

  async function toggleSave(activityId: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const isSaved = savedIds.has(activityId);

    setSavedIds((prev) => {
      const next = new Set(prev);
      if (isSaved) { next.delete(activityId); } else { next.add(activityId); }
      return next;
    });

    const { error } = isSaved
      ? await supabase.from('saved_activities').delete().eq('user_id', user.id).eq('activity_id', activityId)
      : await supabase.from('saved_activities').insert({ user_id: user.id, activity_id: activityId });

    if (error) {
      console.error('toggleSave error:', error);
      setSavedIds((prev) => {
        const next = new Set(prev);
        if (isSaved) { next.add(activityId); } else { next.delete(activityId); }
        return next;
      });
    }
  }

  return (
    <AppView style={styles.container}>
      <ScrollView
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Greeting */}
        <View style={styles.greeting}>
          <AppText style={[styles.greetingName, { color: colors.text, fontFamily: Fonts?.sans }]}>
            Hey there!
          </AppText>
          <AppText style={[styles.greetingQuestion, { color: colors.text, fontFamily: Fonts?.sans }]}>
            What are you doing today?
          </AppText>
        </View>

        {/* Search row */}
        <View style={styles.searchRow}>
          <View style={[styles.searchBar, { backgroundColor: colors.surfaceContainerHigh, borderColor: colors.outlineVariant }]}>
            <IconSymbol name="magnifyingglass" size={18} color={colors.outline} />
            <TextInput
              placeholder="Find activities or ride"
              placeholderTextColor={colors.outline}
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={[styles.searchInput, { color: colors.text, fontFamily: Fonts?.sans }]}
            />
          </View>
          <TouchableOpacity style={[styles.filterButton, { borderColor: colors.outlineVariant, backgroundColor: colors.cardBackground }]}>
            <IconSymbol name="line.3.horizontal.decrease" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Category pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pills}>
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat}
              onPress={() => setSelectedCategory(cat)}
              style={[
                styles.pill,
                selectedCategory === cat
                  ? { backgroundColor: colors.tint, borderColor: colors.tint }
                  : { backgroundColor: 'transparent', borderColor: colors.outline },
              ]}
            >
              <AppText style={[
                styles.pillText,
                { color: selectedCategory === cat ? colors.onImageOverlay : colors.text, fontFamily: Fonts?.sans },
              ]}>
                {cat}
              </AppText>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {!!feedError && <AppText accessibilityRole="alert" style={{ color: colors.text }}>{feedError}</AppText>}
        {loading && activities.length === 0 && featured.length === 0 ? (
          <ActivityIndicator color={colors.tint} style={styles.loader} />
        ) : activities.length === 0 && featured.length === 0 ? (
          <View style={styles.empty}>
            <AppText style={[styles.emptyText, { color: colors.outline, fontFamily: Fonts?.sans }]}>
              No activities found
            </AppText>
          </View>
        ) : (
          <>
            {/* Featured */}
            {featured.length > 0 && (
              <>
                <AppText style={[styles.sectionHeading, { color: colors.text, fontFamily: Fonts?.sans }]}>
                  Featured
                </AppText>
                <FeaturedCarousel activities={featured} onPress={openActivity} />
              </>
            )}

            {/* Everything else, soonest first, a page at a time */}
            {activities.length > 0 && (
              <>
                <AppText style={[styles.sectionHeading, { color: colors.text, fontFamily: Fonts?.sans }]}>
                  Upcoming activities
                </AppText>
                <View style={styles.cardList}>
                  {activities.map((activity) => (
                    <ActivityCard
                      key={activity.id}
                      title={activity.title}
                      category={activity.category}
                      date={activity.date}
                      location={activity.location}
                      imageUrl={activity.imageUrl}
                      attendeeCount={activity.attendeeCount}
                      maxAttendees={activity.maxAttendees}
                      rideSharing={activity.rideSharing}
                      isCampusEvent={activity.isCampusEvent}
                      hostName={activity.hostName}
                      hostAvatarUrl={activity.hostAvatarUrl}
                      waitlistPosition={activity.waitlistPosition}
                      saved={savedIds.has(activity.id)}
                      onBookmarkPress={() => toggleSave(activity.id)}
                      onPress={() => openActivity(activity)}
                    />
                  ))}
                </View>

                {hasMore && (
                  <TouchableOpacity
                    accessibilityRole="button"
                    disabled={loadingMore}
                    onPress={() => void loadMore()}
                    style={[styles.loadMore, { borderColor: colors.tint }, loadingMore && styles.loadMoreBusy]}
                  >
                    {loadingMore ? (
                      <ActivityIndicator color={colors.tint} />
                    ) : (
                      <AppText style={[styles.loadMoreText, { color: colors.tint, fontFamily: Fonts?.sans }]}>
                        Load more
                      </AppText>
                    )}
                  </TouchableOpacity>
                )}
              </>
            )}
          </>
        )}

        <StandaloneRidesSection />
      </ScrollView>
    </AppView>
  );
}

const styles = StyleSheet.create({
  loadMore: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadMoreBusy: {
    opacity: 0.6,
  },
  loadMoreText: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
  },
  container: { flex: 1 },
  content: {
    paddingBottom: 32,
    gap: 16,
  },
  greeting: { gap: 2 },
  greetingName: { fontSize: 16 },
  greetingQuestion: { fontSize: 20, fontWeight: '700' },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 15, padding: 0 },
  filterButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pills: { gap: 8, paddingRight: 16 },
  pill: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  pillText: { fontSize: 14, fontWeight: '500' },
  sectionHeading: { fontSize: 18, fontWeight: '700' },
  cardList: { gap: 12 },
  loader: { marginTop: 40 },
  empty: { alignItems: 'center', marginTop: 40 },
  emptyText: { fontSize: 15 },
});