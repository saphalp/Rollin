import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Linking, Modal, RefreshControl, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';

import { ActivityCard } from '@/components/activity-card';
import { StandaloneRidesSection } from '@/components/rides/standalone-rides-section';
import { AppText } from '@/components/text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { AppView } from '@/components/view';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { campusDateLabel, CampusEvent, campusSortKey, campusUpcoming, plainDescription, uniqueCampusEvents } from '@/lib/home-campus-events';
import { supabase } from '@/lib/supabase';

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
  host?: string;
  imageUrl?: string;
  attendeeCount?: number;
  maxAttendees?: number;
  rideSharing?: boolean;
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
  const [feedError, setFeedError] = useState('');
  const [campusError, setCampusError] = useState('');
  const [now, setNow] = useState(Date.now());
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const generation = useRef(0);

  const fetchActivities = useCallback(async () => {
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
        .select('id, title, category, date_time, max_attendees, ride_sharing, event_type, image_url, rsvps(id)')
        .order('date_time', { ascending: true });
      query = visibleHostIds.length > 0
        ? query.or(`event_type.eq.public,and(event_type.eq.private,host_id.in.(${visibleHostIds.join(',')}))`)
        : query.eq('event_type', 'public');
      const { data, error } = await query;
      if (!current()) return;
      if (error) setFeedError('Unable to refresh activities. Pull down to retry.');
      else setActivities((data ?? []).map((a: any) => ({
        id: a.id, title: a.title, category: a.category ?? 'social',
        sortKey: a.date_time ? `${new Date(a.date_time).toLocaleDateString('sv-SE', { timeZone: 'America/Chicago' })}T${new Date(a.date_time).toLocaleTimeString('en-GB', { timeZone: 'America/Chicago', hour12: false })}` : '9999',
        date: formatDate(a.date_time), imageUrl: a.image_url ?? CATEGORY_IMAGES[a.category],
        attendeeCount: a.rsvps?.length ?? 0, maxAttendees: a.max_attendees ?? 10,
        rideSharing: a.ride_sharing ?? false,
      })));
      try {
        if (!user) { setCampusAccess(false); setCampusEvents([]); return; }
        const { data: allowed, error: accessError } = await supabase.rpc('can_view_latech_events');
        if (!current()) return;
        if (accessError) throw accessError;
        setCampusAccess(allowed === true);
        if (allowed !== true) { setCampusEvents([]); setSelectedEventId(null); return; }
        const rows: CampusEvent[] = [];
        for (let offset = 0; ; offset += 500) {
          const result = await supabase.from('campus_events').select('*')
            .eq('campus', 'latech').order('id').range(offset, offset + 499);
          if (!current()) return;
          if (result.error) throw result.error;
          rows.push(...(result.data ?? []) as CampusEvent[]);
          if ((result.data?.length ?? 0) < 500) break;
        }
        setCampusEvents(uniqueCampusEvents(rows)); setNow(Date.now());
      } catch {
        if (current()) {
          setCampusAccess(false); setCampusEvents([]); setSelectedEventId(null);
          setCampusError('Unable to load campus events. Pull down to retry.');
        }
      }
    } catch {
      if (current()) {
        setActivities([]); setSavedIds(new Set()); setCampusEvents([]); setCampusAccess(false);
        setSelectedEventId(null); setFeedError('Unable to load Home. Pull down to retry.');
      }
    } finally { if (current()) setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { void fetchActivities(); }, [fetchActivities]));
  useEffect(() => {
    let active = true;
    let accountId: string | null | undefined;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextId = session?.user.id ?? null;
      if (nextId === accountId) return;
      accountId = nextId;
      ++generation.current;
      setActivities([]); setCampusEvents([]); setSavedIds(new Set());
      setCampusAccess(false); setSelectedEventId(null);
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
    try { await fetchActivities(); } finally { setRefreshing(false); }
  }, [fetchActivities]);

  function openActivity(activity: Activity) {
    if (activity.campusEvent) setSelectedEventId(activity.campusEvent.id);
    else router.push(`/activity/${activity.id}`);
  }
  const selectedEvent = campusEvents.find(e => e.id === selectedEventId);

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
    .filter(event => campusUpcoming(event, now)).map(event => ({
      id: `campus:${event.id}`, title: event.title,
      category: event.category || 'Campus', date: campusDateLabel(event),
      imageUrl: event.image_url ?? undefined, sortKey: campusSortKey(event), campusEvent: event,
    })) : [];
  const filtered = [...activities, ...campusCards].filter(activity => {
    const matchesCategory = selectedCategory === 'All' || (selectedCategory === 'Campus'
      ? !!activity.campusEvent
      : activity.category.toLowerCase() === selectedCategory.toLowerCase()
      || !!activity.campusEvent?.tags.some(tag => tag.toLowerCase() === selectedCategory.toLowerCase()));
    const searchable = `${activity.title} ${activity.campusEvent?.location ?? ''} ${plainDescription(activity.campusEvent?.description ?? '')}`;
    return matchesCategory && searchable.toLowerCase().includes(searchQuery.trim().toLowerCase());
  }).sort((a, b) => a.sortKey.localeCompare(b.sortKey) || a.id.localeCompare(b.id));

  const featured = filtered[0];
  const recommended = filtered.slice(1);

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
        {!!campusError && <AppText accessibilityRole="alert" style={{ color: colors.text }}>{campusError}</AppText>}
        {selectedCategory === 'Campus' && !loading && !campusAccess && !campusError && (
          <AppText style={{ color: colors.text }}>Sign in with a verified @latech.edu or @email.latech.edu account to view campus events.</AppText>
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
                    {featured.campusEvent && <AppText style={{ color: colors.onImageOverlay, fontSize: 12 }}>LA Tech · Campus Event</AppText>}
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
      </ScrollView>
      <Modal visible={!!selectedEvent && campusAccess} transparent animationType="slide" onRequestClose={() => setSelectedEventId(null)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, { backgroundColor: colors.background }]}>
            <TouchableOpacity accessibilityRole="button" onPress={() => setSelectedEventId(null)}><AppText style={{ color: colors.tint }}>Close</AppText></TouchableOpacity>
            {selectedEvent && <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 24 }}>
              <AppText style={{ color: colors.tint }}>LA Tech · Campus Event</AppText>
              <AppText style={[styles.sectionHeading, { color: colors.text }]}>{selectedEvent.title}</AppText>
              <AppText style={{ color: colors.text }}>{campusDateLabel(selectedEvent)}</AppText>
              <AppText style={{ color: colors.text }}>{[selectedEvent.location, selectedEvent.room].filter(Boolean).join(' · ') || 'Location not provided'}</AppText>
              <AppText style={{ color: colors.text }}>{plainDescription(selectedEvent.description ?? '') || 'Visit the official listing for details.'}</AppText>
              <TouchableOpacity accessibilityRole="link" onPress={() => {
                if (!/^https:\/\/www\.latech\.edu(?:\/|$)/i.test(selectedEvent.official_url)) {
                  Alert.alert('Unavailable', 'The official event link is invalid.'); return;
                }
                void Linking.openURL(selectedEvent.official_url).catch(() => Alert.alert('Unable to open link', 'Please try again.'));
              }}><AppText style={{ color: colors.tint }}>Open official event</AppText></TouchableOpacity>
            </ScrollView>}
          </View>
        </View>
      </Modal>
    </AppView>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalSheet: { maxHeight: '85%', padding: 24, paddingBottom: 36, gap: 16, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
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
