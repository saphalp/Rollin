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
import { fetchFeaturedScores, rankFeatured, type FeaturedScore } from '@/lib/featured-activities';
import { supabase } from '@/lib/supabase';

const CATEGORIES = ['All', 'Social', 'Sports', 'Music', 'Study', 'Outdoor', 'Gaming'];

const CATEGORY_IMAGES: Record<string, string> = {
  social: 'https://picsum.photos/seed/social/900/500',
  sports: 'https://picsum.photos/seed/sports/900/500',
  music: 'https://picsum.photos/seed/music/900/500',
  study: 'https://picsum.photos/seed/study/900/500',
  outdoor: 'https://picsum.photos/seed/outdoor/900/500',
  gaming: 'https://picsum.photos/seed/gaming/900/500',
  grocery: 'https://picsum.photos/seed/grocery/900/500',
};

type Activity = {
  id: string;
  title: string;
  category: string;
  sortKey: string;
  startsAt: number | null;
  date?: string;
  location?: string;
  host?: string;
  imageUrl?: string;
  attendeeCount: number;
  maxAttendees: number;
  rideSharing?: boolean;
  isCampusEvent?: boolean;
  waitlistPosition?: number | null;
  status?: 'active' | 'expired';
};

function formatDate(dateStr: string | null): string | undefined {
  if (!dateStr) return undefined;
  return new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function HomeScreen() {
  const theme = useColorScheme() ?? 'light';
  const colors = Colors[theme];
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [activities, setActivities] = useState<Activity[]>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [featuredScores, setFeaturedScores] = useState<Map<string, FeaturedScore>>(new Map());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [feedError, setFeedError] = useState('');
  const generation = useRef(0);

  const fetchActivities = useCallback(async () => {
    const request = ++generation.current;
    const current = () => request === generation.current;
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
      let query = supabase.from('activities')
        .select('id, title, category, date_time, location, max_attendees, ride_sharing, event_type, image_url, status, source_campus_event_id, rsvps(id)')
        .eq('status', 'active')
        .order('date_time', { ascending: true }).order('id');
      query = visibleHostIds.length > 0
        ? query.or(`event_type.eq.public,and(event_type.eq.private,host_id.in.(${visibleHostIds.join(',')}))`)
        : query.eq('event_type', 'public');
      if (selectedCategory !== 'All') {
        query = query.eq('category', selectedCategory.toLowerCase());
      }
      const { data: spots } = await supabase.rpc('my_waitlist_positions');
      const positions = new Map<string, number>(
        (spots ?? []).map((s: any) => [s.activity_id, s.position_in_line]),
      );

      const rows: any[] = [];
      for (let offset = 0; ; offset += 500) {
        const result = await query.range(offset, offset + 499);
        if (!current()) return;
        if (result.error) throw result.error;
        rows.push(...(result.data ?? []));
        if ((result.data?.length ?? 0) < 500) break;
      }
      const scores = await fetchFeaturedScores(rows.map(a => a.id));
      if (!current()) return;
      setFeaturedScores(scores);
      setActivities(rows.map((a: any) => ({
        id: a.id, title: a.title, category: a.category ?? 'social',
        startsAt: a.date_time ? new Date(a.date_time).getTime() : null,
        sortKey: a.date_time ? `${new Date(a.date_time).toLocaleDateString('sv-SE', { timeZone: 'America/Chicago' })}T${new Date(a.date_time).toLocaleTimeString('en-GB', { timeZone: 'America/Chicago', hour12: false })}` : '9999',
        date: formatDate(a.date_time), location: a.location ?? undefined, imageUrl: a.image_url ?? CATEGORY_IMAGES[a.category],
        attendeeCount: a.rsvps?.length ?? 0, maxAttendees: a.max_attendees ?? 10,
        rideSharing: a.ride_sharing ?? false, isCampusEvent: !!a.source_campus_event_id, waitlistPosition: positions.get(a.id) ?? null, status: a.status ?? 'active',
      })));
    } catch {
      if (current()) {
        setActivities([]); setSavedIds(new Set());
        setFeedError('Unable to load Home. Pull down to retry.');
      }
    } finally { if (current()) setLoading(false); }
  }, [selectedCategory]);

  useFocusEffect(useCallback(() => { void fetchActivities(); }, [fetchActivities]));
  useEffect(() => {
    let active = true;
    let accountKey: string | undefined;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextKey = `${session?.user.id ?? ''}:${session?.user.email ?? ''}:${session?.user.email_confirmed_at ?? ''}`;
      if (nextKey === accountKey) return;
      accountKey = nextKey;
      ++generation.current;
      setActivities([]); setSavedIds(new Set());
      setTimeout(() => { if (active) void fetchActivities(); }, 0);
    });
    const foreground = AppState.addEventListener('change', state => {
      if (state === 'active') void fetchActivities();
    });
    const refresh = setInterval(() => {
      if (AppState.currentState === 'active') void fetchActivities();
    }, 5 * 60_000);
    return () => {
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
      isSaved ? next.delete(activityId) : next.add(activityId);
      return next;
    });

    const { error } = isSaved
      ? await supabase.from('saved_activities').delete().eq('user_id', user.id).eq('activity_id', activityId)
      : await supabase.from('saved_activities').insert({ user_id: user.id, activity_id: activityId });

    if (error) {
      console.error('toggleSave error:', error);
      setSavedIds((prev) => {
        const next = new Set(prev);
        isSaved ? next.add(activityId) : next.delete(activityId);
        return next;
      });
    }
  }

  const filtered = activities.filter(activity => {
    const matchesCategory = selectedCategory === 'All' || activity.category.toLowerCase() === selectedCategory.toLowerCase();
    return matchesCategory && `${activity.title} ${activity.location ?? ''}`.toLowerCase().includes(searchQuery.trim().toLowerCase());
  }).sort((a, b) => a.sortKey.localeCompare(b.sortKey) || a.id.localeCompare(b.id));

  const featured = rankFeatured(filtered, featuredScores);
  const featuredIds = new Set(featured.map(a => a.id));
  const recommended = filtered.filter(a => !featuredIds.has(a.id));

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
        {loading && filtered.length === 0 ? (
          <ActivityIndicator color={colors.tint} style={styles.loader} />
        ) : filtered.length === 0 ? (
          <View style={styles.empty}>
            <AppText style={[styles.emptyText, { color: colors.outline, fontFamily: Fonts?.sans }]}>
              No activities found
            </AppText>
          </View>
        ) : (
          <>
            {/* Featured */}
            <AppText style={[styles.sectionHeading, { color: colors.text, fontFamily: Fonts?.sans }]}>
              Featured
            </AppText>
            <FeaturedCarousel activities={featured} onPress={openActivity} />

            {/* Recommended */}
            {recommended.length > 0 && (
              <>
                <AppText style={[styles.sectionHeading, { color: colors.text, fontFamily: Fonts?.sans }]}>
                  Recommended for you
                </AppText>
                <View style={styles.cardList}>
                  {recommended.map((activity) => (
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
                      waitlistPosition={activity.waitlistPosition}
                      saved={savedIds.has(activity.id)}
                      onBookmarkPress={() => toggleSave(activity.id)}
                      onPress={() => openActivity(activity)}
                    />
                  ))}
                </View>
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