import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, RefreshControl, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';

import { ActivityCard } from '@/components/activity-card';
import { StandaloneRidesSection } from '@/components/rides/standalone-rides-section';
import { AppText } from '@/components/text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { AppView } from '@/components/view';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { campusDateLabel, CampusEvent, campusSortKey, campusUpcoming, plainDescription, uniqueCampusEvents } from '@/lib/home-campus-events';
import { balancedHomeFeed, HOME_CAMPUS_LIMIT, isAcademicCalendar } from '@/lib/home-feed';
import { supabase } from '@/lib/supabase';
import { getCurrentUniversity, type University } from '@/lib/university';

const CATEGORIES = ['All', 'Campus', 'Social', 'Sports', 'Music', 'Study', 'Outdoor', 'Gaming'];

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
  campusEvent?: CampusEvent;
  date?: string;
  location?: string;
  host?: string;
  imageUrl?: string;
  attendeeCount?: number;
  maxAttendees?: number;
  rideSharing?: boolean;
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
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [campusEvents, setCampusEvents] = useState<CampusEvent[]>([]);
  const [campusAccess, setCampusAccess] = useState(false);
  const [university, setUniversity] = useState<University | null>(null);
  const [attendance, setAttendance] = useState<Record<string, number>>({});
  const [feedError, setFeedError] = useState('');
  const [campusError, setCampusError] = useState('');
  const [now, setNow] = useState(Date.now());
  const [campusRotation, setCampusRotation] = useState(0);
  const generation = useRef(0);

  const campusCache = useRef<{ campus: string; events: CampusEvent[] } | null>(null);

  const fetchActivities = useCallback(async (rotateCampus = false) => {
    const request = ++generation.current;
    const current = () => request === generation.current;
    setLoading(true);
    setFeedError(''); setCampusError('');
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
        .select('id, title, category, date_time, location, max_attendees, ride_sharing, event_type, image_url, status, rsvps(id)')
        .eq('status', 'active')
        .order('date_time', { ascending: true })
        .limit(20);
      query = visibleHostIds.length > 0
        ? query.or(`event_type.eq.public,and(event_type.eq.private,host_id.in.(${visibleHostIds.join(',')}))`)
        : query.eq('event_type', 'public');
      if (selectedCategory !== 'All' && selectedCategory !== 'Campus') {
        query = query.eq('category', selectedCategory.toLowerCase());
      }
      const { data, error } = await query;
      if (!current()) return;
      if (error) setFeedError('Unable to refresh activities. Pull down to retry.');
      else setActivities((data ?? []).map((a: any) => ({
        id: a.id, title: a.title, category: a.category ?? 'social',
        sortKey: a.date_time ? `${new Date(a.date_time).toLocaleDateString('sv-SE', { timeZone: 'America/Chicago' })}T${new Date(a.date_time).toLocaleTimeString('en-GB', { timeZone: 'America/Chicago', hour12: false })}` : '9999',
        date: formatDate(a.date_time), location: a.location ?? undefined, imageUrl: a.image_url ?? CATEGORY_IMAGES[a.category],
        attendeeCount: a.rsvps?.length ?? 0, maxAttendees: a.max_attendees ?? 10,
        rideSharing: a.ride_sharing ?? false, status: a.status ?? 'active',
      })));
      try {
        if (!user) { setCampusAccess(false); setUniversity(null); setCampusEvents([]); setAttendance({}); return; }
        const campus = await getCurrentUniversity();
        if (!current()) return;
        setUniversity(campus);
        setCampusAccess(!!campus?.calendar_enabled);
        if (!campus?.calendar_enabled) { setCampusEvents([]); setAttendance({}); return; }
        let events = campusCache.current?.campus === campus.id ? campusCache.current.events : null;
        if (rotateCampus || !events) {
          const rows: CampusEvent[] = [];
          for (let offset = 0; ; offset += 500) {
            const result = await supabase.from('campus_events').select('*')
              .eq('campus', campus.id).order('id').range(offset, offset + 499);
            if (!current()) return;
            if (result.error) throw result.error;
            rows.push(...(result.data ?? []) as CampusEvent[]);
            if ((result.data?.length ?? 0) < 500) break;
          }
          events = uniqueCampusEvents(rows).filter(event => !isAcademicCalendar(event));
          campusCache.current = { campus: campus.id, events };
        }
        setCampusEvents(events); setNow(Date.now());
        // Focus/attendance reloads preserve the preview; only user actions rotate it.
        if (rotateCampus) setCampusRotation(previous => previous + HOME_CAMPUS_LIMIT);
        try {
          const counts: Record<string, number> = {};
          for (let offset = 0; offset < events.length; offset += 200) {
            const result = await supabase.rpc('campus_event_attendance', {
              event_ids: events.slice(offset, offset + 200).map(e => e.id),
            });
            if (!current()) return;
            if (result.error) throw result.error;
            for (const item of result.data ?? []) counts[item.event_id] = Number(item.attendee_count);
          }
          setAttendance(counts);
        } catch {
          if (current()) { setAttendance({}); setCampusError('Campus attendance is temporarily unavailable. Pull down to refresh.'); }
        }
      } catch {
        if (current()) {
          setCampusAccess(false); setUniversity(null); setCampusEvents([]); setAttendance({});
          setCampusError('Unable to load campus events. Pull down to retry.');
        }
      }
    } catch {
      if (current()) {
        setActivities([]); setSavedIds(new Set()); setCampusEvents([]); setAttendance({}); setCampusAccess(false); setUniversity(null);
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
      campusCache.current = null; setCampusRotation(0);
      ++generation.current;
      setActivities([]); setCampusEvents([]); setAttendance({}); setSavedIds(new Set());
      setCampusAccess(false); setUniversity(null);
      setTimeout(() => { if (active) void fetchActivities(); }, 0);
    });
    const foreground = AppState.addEventListener('change', state => {
      if (state === 'active') void fetchActivities();
    });
    const refresh = setInterval(() => {
      if (AppState.currentState === 'active') void fetchActivities();
    }, 5 * 60_000);
    const clock = setInterval(() => setNow(Date.now()), 30_000);
    return () => {
      active = false; ++generation.current; subscription.unsubscribe();
      foreground.remove(); clearInterval(refresh); clearInterval(clock);
    };
  }, [fetchActivities]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await fetchActivities(true); } finally { setRefreshing(false); }
  }, [fetchActivities]);

  function openActivity(activity: Activity) {
    if (activity.campusEvent) router.push(`/campus-event/${activity.campusEvent.id}`);
    else router.push(`/activity/${activity.id}`);
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

  const campusCards: Activity[] = campusAccess ? campusEvents
    .filter(event => !isAcademicCalendar(event) && campusUpcoming(event, now)).map(event => ({
      id: `campus:${event.id}`, title: event.title,
      category: event.category || 'Campus', date: campusDateLabel(event),
      location: [event.location, event.room].filter(Boolean).join(' · ') || 'Location not provided',
      attendeeCount: attendance[event.id],
      imageUrl: event.image_url ?? undefined, sortKey: campusSortKey(event), campusEvent: event,
    })) : [];
  const matching = [...activities, ...campusCards].filter(activity => {
    const matchesCategory = selectedCategory === 'All' || (selectedCategory === 'Campus'
      ? !!activity.campusEvent
      : activity.category.toLowerCase() === selectedCategory.toLowerCase()
      || !!activity.campusEvent?.tags.some(tag => tag.toLowerCase() === selectedCategory.toLowerCase()));
    const searchable = `${activity.title} ${activity.campusEvent?.location ?? ''} ${plainDescription(activity.campusEvent?.description ?? '')}`;
    return matchesCategory && searchable.toLowerCase().includes(searchQuery.trim().toLowerCase());
  }).sort((a, b) => a.sortKey.localeCompare(b.sortKey) || a.id.localeCompare(b.id));

  const filtered = selectedCategory === 'All'
    ? balancedHomeFeed(matching, campusRotation)
    : matching;

  const featured = filtered[0];
  const recommended = filtered.slice(1);

  return (
    <AppView style={styles.container}>
      <TourScrollView
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
        <TourTarget id="home-search"><View style={styles.searchRow}>
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
        </View></TourTarget>

        {/* Category pills */}
        <TourTarget id="home-categories"><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pills}>
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
        </ScrollView></TourTarget>

        {!!feedError && <AppText accessibilityRole="alert" style={{ color: colors.text }}>{feedError}</AppText>}
        {!!campusError && <AppText accessibilityRole="alert" style={{ color: colors.text }}>{campusError}</AppText>}
        {selectedCategory === 'Campus' && !loading && !campusAccess && !campusError && (
          <AppText style={{ color: colors.text }}>{university ? `Calendar integration is not available for ${university.short_name} yet.` : 'Verify your email from a supported university to view its campus events.'}</AppText>
        )}
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
            {featured && (
              <>
                <AppText style={[styles.sectionHeading, { color: colors.text, fontFamily: Fonts?.sans }]}>
                  Featured
                </AppText>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => openActivity(featured)}
                  style={[styles.featuredCard, { backgroundColor: colors.primaryContainer }]}
                >
                  {featured.imageUrl ? (
                    <Image
                      source={{ uri: featured.imageUrl }}
                      style={StyleSheet.absoluteFill}
                      contentFit="cover"
                      cachePolicy="memory-disk"
                    />
                  ) : null}
                  <View style={styles.featuredDim} />
                  {featured.campusEvent && (
                    <View style={[styles.rideBadge, { backgroundColor: colors.secondaryContainer }]}>
                      <AppText style={[styles.rideBadgeText, { color: colors.onSecondaryContainer }]}>Campus Event</AppText>
                    </View>
                  )}
                  {!featured.campusEvent && featured.rideSharing && (
                    <View style={[styles.rideBadge, { backgroundColor: colors.secondaryContainer }]}>
                      <IconSymbol name="car.fill" size={12} color={colors.onSecondaryContainer} />
                      <AppText style={[styles.rideBadgeText, { color: colors.onSecondaryContainer, fontFamily: Fonts?.sans }]}>
                        Ride sharing available
                      </AppText>
                    </View>
                  )}
                  <View style={styles.featuredOverlay}>
                    {featured.campusEvent && <AppText style={{ color: colors.onImageOverlay, fontSize: 12 }}>{university?.short_name ?? 'University'} · Campus Event</AppText>}
                    {featured.host && !featured.campusEvent && (
                      <View style={styles.hostRow}>
                        <View style={[styles.hostAvatar, { backgroundColor: colors.tint }]} />
                        <AppText style={[styles.hostedBy, { fontFamily: Fonts?.sans, color: colors.onImageOverlay }]}>
                          Hosted by {featured.host}
                        </AppText>
                      </View>
                    )}
                    <AppText numberOfLines={2} style={[styles.featuredTitle, { fontFamily: Fonts?.sans, color: colors.onImageOverlay }]}>
                      {featured.title}
                    </AppText>
                    {featured.date && <AppText style={{ color: colors.onImageOverlay, fontSize: 12 }}>{featured.date}</AppText>}
                    {!!featured.location && <View style={styles.joinedRow}>
                      <IconSymbol name="mappin" size={14} color={colors.onImageOverlay} />
                      <AppText numberOfLines={1} style={{ color: colors.onImageOverlay, flexShrink: 1, fontSize: 12 }}>{featured.location}</AppText>
                    </View>}
                    {featured.campusEvent && featured.attendeeCount !== undefined && <View style={styles.joinedRow}>
                      <IconSymbol name="person.2.fill" size={14} color={colors.onImageOverlay} />
                      <AppText style={[styles.joinedText, { color: colors.onImageOverlay }]}>{featured.attendeeCount} joined</AppText>
                    </View>}
                    {!featured.campusEvent && <View style={styles.joinedRow}>
                      <IconSymbol name="person.2.fill" size={14} color={colors.onImageOverlay} />
                      <AppText style={[styles.joinedText, { fontFamily: Fonts?.sans, color: colors.onImageOverlay }]}>
                        {featured.attendeeCount}/{featured.maxAttendees} joined
                      </AppText>
                    </View>}
                  </View>
                </TouchableOpacity>
              </>
            )}

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
                      isCampusEvent={!!activity.campusEvent}
                      title={activity.title}
                      category={activity.category}
                      date={activity.date}
                      location={activity.location}
                      imageUrl={activity.imageUrl}
                      attendeeCount={activity.attendeeCount}
                      maxAttendees={activity.maxAttendees}
                      rideSharing={activity.rideSharing}
                      saved={savedIds.has(activity.id)}
                      onBookmarkPress={activity.campusEvent ? undefined : () => toggleSave(activity.id)}
                      onPress={() => openActivity(activity)}
                    />
                  ))}
                </View>
              </>
            )}
          </>
        )}

        <StandaloneRidesSection />
      </TourScrollView>
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
  featuredCard: {
    borderRadius: 12,
    height: 180,
    overflow: 'hidden',
    justifyContent: 'space-between',
    padding: 12,
  },
  featuredDim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  rideBadge: {
    flexDirection: 'row',
    alignSelf: 'flex-end',
    alignItems: 'center',
    gap: 4,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  rideBadgeText: { fontSize: 12, fontWeight: '600' },
  featuredOverlay: { gap: 4 },
  hostRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  hostAvatar: { width: 20, height: 20, borderRadius: 10 },
  hostedBy: { fontSize: 12 },
  featuredTitle: { fontSize: 22, fontWeight: '700' },
  joinedRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  joinedText: { fontSize: 13 },
  cardList: { gap: 12 },
  loader: { marginTop: 40 },
  empty: { alignItems: 'center', marginTop: 40 },
  emptyText: { fontSize: 15 },
});