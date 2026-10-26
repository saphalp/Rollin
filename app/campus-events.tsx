import { AppText } from '@/components/text';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { campusDateLabel, type CampusEvent } from '@/lib/home-campus-events';
import { supabase } from '@/lib/supabase';
import { getCurrentUniversity, type University } from '@/lib/university';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, Pressable, RefreshControl, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const PAGE_SIZE = 10;

export default function CampusEventsScreen() {
  const colors = Colors[useColorScheme() ?? 'light'];
  const insets = useSafeAreaInsets();
  const [university, setUniversity] = useState<University | null>(null);
  const [events, setEvents] = useState<CampusEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'upcoming' | 'past' | 'archived'>('upcoming');
  const past = tab === 'past';
  const [savedEvents, setSavedEvents] = useState<CampusEvent[]>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [savedMore, setSavedMore] = useState(false);
  const savedOffsetRef = useRef(0);
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [savedError, setSavedError] = useState('');
  const [savedLoading, setSavedLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const generation = useRef(0);
  const filtersRef = useRef({ past, search });
  useEffect(() => {
    filtersRef.current = { past, search };
  }, [past, search]);
  const savedGeneration = useRef(0);
  const saveInFlight = useRef(new Set<string>());
  const fetching = useRef(false);
  const pageOffset = useRef(0);
  const asOf = useRef(new Date().toISOString());

  const fetchPage = useCallback(async (campusId: string, offset: number, request: number,
    mode: 'replace' | 'append', selectedPast: boolean, selectedSearch: string) => {
    if (mode === 'append') setLoadingMore(true);
    else setLoading(true);
    fetching.current = true;
    setError('');
    try {
      // One extra record tells us whether another page exists.
      const { data, error: queryError } = await supabase.rpc('get_campus_events_page', {
        p_campus: campusId, p_past: selectedPast, p_search: selectedSearch,
        p_offset: offset, p_page_size: PAGE_SIZE + 1, p_as_of: asOf.current,
      });
      if (queryError) throw queryError;
      if (request !== generation.current) return;
      const rows = (data ?? []) as CampusEvent[];
      const page = rows.slice(0, PAGE_SIZE);
      setHasMore(rows.length > PAGE_SIZE);
      pageOffset.current = offset + page.length;
      setEvents(current => mode === 'replace' ? page : [...current, ...page]);
    } catch (err) {
      if (request === generation.current) {
        setError(err instanceof Error ? err.message : 'Unable to load campus events.');
        if (mode === 'replace') { setEvents([]); setHasMore(false); }
      }
    } finally {
      if (request === generation.current) {
        fetching.current = false;
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, []);

  const reload = useCallback(async (selectedPast: boolean, selectedSearch: string) => {
    const request = ++generation.current;
    fetching.current = true;
    pageOffset.current = 0;
    asOf.current = new Date().toISOString();
    setLoading(true); setLoadingMore(false); setEvents([]); setHasMore(false); setError('');
    try {
      const campus = await getCurrentUniversity();
      if (request !== generation.current) return;
      setUniversity(campus);
      if (!campus?.calendar_enabled) throw new Error('Verify your supported university email to view its calendar.');
      await fetchPage(campus.id, 0, request, 'replace', selectedPast, selectedSearch);
    } catch (err) {
      if (request === generation.current) {
        setError(err instanceof Error ? err.message : 'Unable to load campus events.');
        fetching.current = false;
        setLoading(false);
      }
    }
  }, [fetchPage]);

  useEffect(() => {
    const timer = setTimeout(() => { void reload(past, search.trim()); }, search ? 300 : 0);
    return () => { clearTimeout(timer); ++generation.current; };
  }, [past, search, reload]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      ++generation.current;
      setUniversity(null);
      void reload(filtersRef.current.past, filtersRef.current.search.trim());
    });
    return () => { ++generation.current; subscription.unsubscribe(); };
  }, [reload]);

  // Bookmarks are separate from campus events: no change to the existing pagination RPC.
  const refreshSavedIds = useCallback(async (uid: string) => {
    const ids = new Set<string>();
    for (let offset = 0; ; offset += 500) {
      const { data, error: queryError } = await supabase.from('saved_campus_events')
        .select('campus_event_id').eq('user_id', uid).range(offset, offset + 499);
      if (queryError) throw queryError;
      (data ?? []).forEach(row => ids.add(row.campus_event_id));
      if ((data?.length ?? 0) < 500) break;
    }
    return ids;
  }, []);

  const loadSaved = useCallback(async (reset: boolean) => {
    const request = ++savedGeneration.current;
    const offset = reset ? 0 : savedOffsetRef.current;
    setSavedLoading(true);
    setSavedError('');
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) throw new Error('Sign in to view saved events.');
      const campus = await getCurrentUniversity();
      if (!campus?.calendar_enabled) throw new Error('Your campus calendar is not available.');
      const { data, error: queryError } = await supabase.from('saved_campus_events')
        .select('campus_event_id, campus_events!inner(*)')
        .eq('user_id', auth.user.id)
        .eq('campus_events.campus', campus.id)
        .order('saved_at', { ascending: false })
        .order('campus_event_id', { ascending: true })
        .range(offset, offset + PAGE_SIZE);
      if (queryError) throw queryError;
      if (request !== savedGeneration.current) return;
      const records = (data ?? []) as unknown as Array<{ campus_event_id: string; campus_events: CampusEvent | CampusEvent[] }>;
      const page = records.slice(0, PAGE_SIZE).flatMap(row => {
        const event = Array.isArray(row.campus_events) ? row.campus_events[0] : row.campus_events;
        return event ? [event] : [];
      });
      setSavedEvents(current => reset ? page : [...current, ...page]);
      savedOffsetRef.current = offset + Math.min(records.length, PAGE_SIZE);
      setSavedMore(records.length > PAGE_SIZE);
    } catch (err) {
      if (request === savedGeneration.current) setSavedError(err instanceof Error ? err.message : 'Unable to load saved events.');
    } finally {
      if (request === savedGeneration.current) setSavedLoading(false);
    }
  }, []);

  // Fetch bookmark state on mount/account change, so icons also work on All Events.
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (!active) return;
        const uid = data.user?.id ?? null;
        setUserId(uid);
        const ids = uid ? await refreshSavedIds(uid) : new Set<string>();
        if (active) setSavedIds(ids);
      } catch (err) {
        if (active) setSavedError(err instanceof Error ? err.message : 'Unable to load bookmarks.');
      }
    };
    void refresh();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      ++savedGeneration.current;
      setSavedEvents([]); savedOffsetRef.current = 0; setSavedMore(false);
      void refresh();
    });
    return () => { active = false; ++savedGeneration.current; subscription.unsubscribe(); };
  }, [refreshSavedIds]);

  useEffect(() => {
    if (tab === 'archived') void loadSaved(true);
    // Reload on entering Saved tab, not on every pagination offset change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  async function toggleSaved(event: CampusEvent) {
    if (saveInFlight.current.has(event.id)) return;
    if (!userId) { Alert.alert('Sign in required', 'Sign in to save campus events.'); return; }
    saveInFlight.current.add(event.id);
    setSavingIds(current => new Set([...current, event.id]));
    const previouslySaved = savedIds.has(event.id);
    try {
      const result = previouslySaved
        ? await supabase.from('saved_campus_events').delete().eq('user_id', userId).eq('campus_event_id', event.id)
        : await supabase.from('saved_campus_events').insert({ user_id: userId, campus_event_id: event.id });
      if (result.error) throw result.error;
      const { data: currentAuth } = await supabase.auth.getUser();
      if (currentAuth.user?.id !== userId) return;
      setSavedIds(current => {
        const next = new Set(current);
        if (previouslySaved) next.delete(event.id); else next.add(event.id);
        return next;
      });
      if (previouslySaved && tab === 'archived') {
        setSavedEvents(current => current.filter(item => item.id !== event.id));
        // Refresh to fill vacancies from the saved-event database list.
        await loadSaved(true);
      }
    } catch (err) {
      Alert.alert('Unable to update saved event', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      saveInFlight.current.delete(event.id);
      setSavingIds(current => { const next = new Set(current); next.delete(event.id); return next; });
    }
  }

  function loadMore() {
    if (fetching.current || loading || loadingMore || !hasMore || !university) return;
    void fetchPage(university.id, pageOffset.current, generation.current, 'append', past, search.trim());
  }

  const activeItems = tab !== 'archived' ? events : savedEvents;

  return <View style={[styles.screen, { backgroundColor: colors.background, paddingTop: insets.top }]}>
    <View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')} style={styles.backButton}>
        <Ionicons name="chevron-back" size={26} color={colors.tint} />
      </Pressable>
      <View style={styles.headerTitle}>
        <AppText style={[styles.title, { color: colors.text }]}>Campus Events</AppText>
        <AppText style={[styles.subtitle, { color: colors.outline }]}>{university?.short_name ?? 'LA Tech'} · Calendar</AppText>
      </View>
      <View style={styles.backButton} />
    </View>

    <FlatList
      data={activeItems}
      keyExtractor={item => item.id}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 32 }]}
      refreshControl={<RefreshControl refreshing={tab !== 'archived' ? loading : savedLoading} onRefresh={() => { if (tab !== 'archived') { void reload(past, search.trim()); if (userId) void refreshSavedIds(userId).then(setSavedIds).catch(() => { }); } else void loadSaved(true); }} />}
      ListHeaderComponent={<View style={styles.filters}>
        <View style={[styles.tabBar, { backgroundColor: colors.surfaceContainerHigh }]}>
          {(['upcoming', 'past', 'archived'] as const).map(value => <Pressable
            key={value} accessibilityRole="button" accessibilityState={{ selected: tab === value }}
            onPress={() => setTab(value)}
            style={[styles.tab, tab === value && { backgroundColor: colors.tint }]}
          >
            <AppText style={[styles.tabText, { color: tab === value ? colors.onImageOverlay : colors.text }]}>
              {value === 'upcoming' ? 'Upcoming' : value === 'past' ? 'Past' : 'Archived'}
            </AppText>
          </Pressable>)}
        </View>
        {tab !== 'archived' && <View style={[styles.searchBox, { backgroundColor: colors.cardBackground, borderColor: colors.outlineVariant }]}>
          <Ionicons name="search-outline" size={19} color={colors.outline} />
          <TextInput accessibilityLabel="Search campus events" placeholder="Search events or locations" placeholderTextColor={colors.outline} value={search} onChangeText={setSearch} style={[styles.searchInput, { color: colors.text }]} />
          {!!search && <Pressable accessibilityLabel="Clear search" onPress={() => setSearch('')}><Ionicons name="close-circle" size={19} color={colors.outline} /></Pressable>}
        </View>}
        {tab !== 'archived' && !!error && <View><AppText accessibilityRole="alert" style={{ color: colors.error }}>{error}</AppText><Pressable onPress={() => void reload(past, search.trim())}><AppText style={{ color: colors.tint }}>Retry</AppText></Pressable></View>}
        {tab === 'archived' && !!savedError && <View><AppText accessibilityRole="alert" style={{ color: colors.error }}>{savedError}</AppText><Pressable onPress={() => void loadSaved(true)}><AppText style={{ color: colors.tint }}>Retry</AppText></Pressable></View>}
        <View style={styles.resultHeader}>
          <AppText style={[styles.resultTitle, { color: colors.text }]}>{tab === 'upcoming' ? 'Upcoming events' : tab === 'past' ? 'Past events' : 'Archived events'}</AppText>
          <AppText style={[styles.resultCount, { color: colors.outline }]}>{activeItems.length} shown</AppText>
        </View>
      </View>}
      ListEmptyComponent={(tab !== 'archived' ? loading : savedLoading)
        ? <ActivityIndicator style={styles.empty} color={colors.tint} />
        : <View style={styles.empty}><Ionicons name={tab === 'archived' ? 'bookmark-outline' : 'calendar-outline'} size={30} color={colors.outline} /><AppText style={{ color: colors.outline }}>{tab === 'archived' ? 'No archived events yet. Bookmark an event to keep it here.' : 'No campus events found.'}</AppText></View>}
      ListFooterComponent={(tab !== 'archived' ? hasMore : savedMore) ? <Pressable accessibilityRole="button" disabled={tab !== 'archived' ? (loadingMore || loading) : savedLoading} onPress={() => { if (tab !== 'archived') loadMore(); else void loadSaved(false); }} style={[styles.loadMore, { borderColor: colors.tint }]}>{(tab !== 'archived' ? loadingMore : savedLoading) ? <ActivityIndicator color={colors.tint} /> : <AppText style={{ color: colors.tint, fontWeight: '700' }}>Load 10 more  ↓</AppText>}</Pressable> : null}
      renderItem={({ item }) => {
        const bookmarked = savedIds.has(item.id);
        return <Pressable accessibilityRole="button" onPress={() => router.push(`/campus-event/${item.id}`)} style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.outlineVariant }]}>
          {/* Only show the picture if the feed supplied one. The event text remains compact otherwise. */}
          {item.image_url ? <View style={styles.imageArea}>
            <Image source={{ uri: item.image_url }} style={styles.cardImage} resizeMode="cover" />
            <View style={styles.imageShade} pointerEvents="none" />
          </View> : null}
          <View style={styles.cardBody}>
            <View style={styles.cardTopRow}>
              <AppText style={[styles.eventTitle, { color: colors.text }]} numberOfLines={3}>{item.title}</AppText>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={bookmarked ? 'Remove saved event' : 'Save event'}
                accessibilityState={{ disabled: savingIds.has(item.id), selected: bookmarked }}
                disabled={savingIds.has(item.id)}
                onPress={e => { e.stopPropagation(); void toggleSaved(item); }}
                hitSlop={8}
                style={[styles.bookmark, { backgroundColor: colors.surfaceContainerHigh }]}
              >
                <Ionicons name={bookmarked ? 'bookmark' : 'bookmark-outline'} size={21} color={colors.tint} />
              </Pressable>
            </View>
            <View style={styles.details}>
              <View style={styles.detailRow}><Ionicons name="calendar-outline" size={16} color={colors.outline} /><AppText style={[styles.detail, { color: colors.text }]}>{campusDateLabel(item)}</AppText></View>
              <View style={styles.detailRow}><Ionicons name="location-outline" size={16} color={colors.outline} /><AppText style={[styles.detail, { color: colors.text }]} numberOfLines={2}>{[item.location, item.room].filter(Boolean).join(' · ') || 'Location not provided'}</AppText></View>
            </View>
          </View>
        </Pressable>;
      }}
    />
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 15, flexDirection: 'row', alignItems: 'center' },
  backButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, gap: 4, alignItems: 'center' },
  title: { fontSize: 23, fontWeight: '800', textAlign: 'center' },
  subtitle: { fontSize: 12 },
  list: { paddingHorizontal: 18, flexGrow: 1 },
  filters: { gap: 14, paddingTop: 3, marginBottom: 16 },
  tabBar: { flexDirection: 'row', padding: 4, borderRadius: 14, gap: 4 },
  tab: { flex: 1, minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 11 },
  tabText: { fontWeight: '700', fontSize: 13 },
  searchBox: { minHeight: 46, borderWidth: 1, borderRadius: 13, flexDirection: 'row', gap: 9, alignItems: 'center', paddingHorizontal: 13 },
  searchInput: { flex: 1, paddingVertical: 9, fontSize: 14 },
  resultHeader: { marginTop: 3, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  resultTitle: { fontSize: 17, fontWeight: '800' },
  resultCount: { fontSize: 12 },
  card: { borderWidth: 1, borderRadius: 16, overflow: 'hidden', marginBottom: 12 },
  imageArea: { height: 116, overflow: 'hidden' },
  cardImage: { width: '100%', height: '100%' },
  imageShade: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.08)' },
  cardBody: { padding: 14, gap: 9 },
  cardTopRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  bookmark: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18 },
  eventTitle: { flex: 1, fontSize: 17, lineHeight: 23, fontWeight: '800' },
  details: { gap: 7 },
  detailRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  detail: { flex: 1, fontSize: 13, lineHeight: 19 },
  loadMore: { padding: 14, borderWidth: 1, borderRadius: 13, marginBottom: 18, alignItems: 'center' },
  empty: { paddingVertical: 36, alignItems: 'center', gap: 9 },
});
