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
  const [past, setPast] = useState(false);
  const [tab, setTab] = useState<'all' | 'saved'>('all');
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
  useEffect(() => { filtersRef.current = { past, search }; }, [past, search]);
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
    if (tab === 'saved') void loadSaved(true);
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
      if (previouslySaved && tab === 'saved') {
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

  return <View style={[styles.screen, { backgroundColor: colors.background, paddingTop: insets.top }]}>
    <View style={styles.header}>
      <Pressable accessibilityRole="button" onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')}><AppText style={{ color: colors.tint }}>‹ Back</AppText></Pressable>
      <AppText style={styles.title}>Campus Events</AppText>
    </View>
    <FlatList data={tab === 'all' ? events : savedEvents} keyExtractor={item => item.id} contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
      refreshControl={<RefreshControl refreshing={tab === 'all' ? loading : savedLoading} onRefresh={() => { if (tab === 'all') { void reload(past, search.trim()); if (userId) void refreshSavedIds(userId).then(setSavedIds).catch(() => { }); } else void loadSaved(true); }} />}
      ListHeaderComponent={<View style={styles.filters}>
        <AppText>{university?.short_name ?? 'Your university'} · Calendar events</AppText>
        <View style={styles.row}>
          {(['all', 'saved'] as const).map(value => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: tab === value }} onPress={() => setTab(value)} style={[styles.chip, { borderColor: colors.tint, backgroundColor: tab === value ? colors.tint : colors.background }]}><AppText style={{ color: tab === value ? colors.onImageOverlay : colors.tint }}>{value === 'all' ? 'All Events' : 'Saved Events'}</AppText></Pressable>)}
        </View>
        <AppText>Open an event to host an activity with your friends.</AppText>
        {tab === 'all' && <TextInput accessibilityLabel="Search campus events" placeholder="Search events or location" placeholderTextColor={colors.outline} value={search} onChangeText={setSearch} style={[styles.input, { color: colors.text, borderColor: colors.outlineVariant }]} />}
        {tab === 'all' && <View style={styles.row}>{['Upcoming', 'Past'].map((label, index) => <Pressable key={label} accessibilityRole="button" accessibilityState={{ selected: past === !!index }} onPress={() => setPast(!!index)} style={[styles.chip, { borderColor: colors.tint, backgroundColor: past === !!index ? colors.tint : colors.background }]}><AppText style={{ color: past === !!index ? colors.onImageOverlay : colors.tint }}>{label}</AppText></Pressable>)}</View>}
        {tab === 'all' && !!error && <View><AppText accessibilityRole="alert" style={{ color: colors.error }}>{error}</AppText><Pressable onPress={() => void reload(past, search.trim())}><AppText style={{ color: colors.tint }}>Retry</AppText></Pressable></View>}
        {!!savedError && tab === 'saved' && <AppText accessibilityRole="alert" style={{ color: colors.error }}>{savedError}  <AppText onPress={() => void loadSaved(true)} style={{ color: colors.tint }}>Retry</AppText></AppText>}
        <AppText>{tab === 'all' ? `Showing ${events.length} ${past ? 'past' : 'upcoming'} events` : `Showing ${savedEvents.length} saved events`}</AppText>
      </View>}
      ListEmptyComponent={(tab === 'all' ? loading : savedLoading) ? <ActivityIndicator /> : <AppText>{tab === 'saved' ? 'No saved campus events yet.' : 'No campus events found.'}</AppText>}
      ListFooterComponent={(tab === 'all' ? hasMore : savedMore) ? <Pressable accessibilityRole="button" disabled={tab === 'all' ? (loadingMore || loading) : savedLoading} onPress={() => { if (tab === 'all') loadMore(); else void loadSaved(false); }} style={[styles.loadMore, { borderColor: colors.tint }]}>{(tab === 'all' ? loadingMore : savedLoading) ? <ActivityIndicator /> : <AppText style={{ color: colors.tint, fontWeight: '700' }}>Load 10 more</AppText>}</Pressable> : null}
      renderItem={({ item }) => <Pressable accessibilityRole="button" onPress={() => router.push(`/campus-event/${item.id}`)} style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.outlineVariant }]}>
        {item.image_url ? (
          <Image source={{ uri: item.image_url }} style={styles.cardImage} resizeMode="cover" />
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={savedIds.has(item.id) ? 'Remove saved event' : 'Save event'}
          accessibilityState={{ disabled: savingIds.has(item.id), selected: savedIds.has(item.id) }}
          disabled={savingIds.has(item.id)}
          onPress={e => { e.stopPropagation(); void toggleSaved(item); }}
          hitSlop={8}
          style={[styles.bookmark, { backgroundColor: item.image_url ? 'rgba(0,0,0,0.36)' : colors.tint }]}
        >
          <Ionicons name={savedIds.has(item.id) ? 'bookmark' : 'bookmark-outline'} size={27} color="#fff" />
        </Pressable>
        <View style={styles.cardBody}>
          <AppText style={[styles.eventTitle, styles.titleWithBookmark]}>{item.title}</AppText>
          <AppText style={styles.detail}>📅  {campusDateLabel(item)}</AppText>
          <AppText style={styles.detail}>📍  {[item.location, item.room].filter(Boolean).join(' · ') || 'Location not provided'}</AppText>
          <View style={styles.cardFooter}><AppText style={{ color: colors.tint, fontWeight: '700' }}>View event  →</AppText></View>
        </View>
      </Pressable>} />
  </View>;
}
const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { padding: 20, flexDirection: 'row', alignItems: 'center', gap: 20 },
  title: { fontSize: 22, fontWeight: '700' },
  list: { paddingHorizontal: 20, flexGrow: 1 },
  filters: { gap: 12, marginBottom: 18 },
  row: { flexDirection: 'row', gap: 12 },
  chip: { borderWidth: 1, borderRadius: 20, padding: 12 },
  input: { borderWidth: 1, borderRadius: 14, padding: 12 },
  card: { borderWidth: 1, borderRadius: 16, marginBottom: 14, overflow: 'hidden' },
  cardImage: { width: '100%', height: 190 },
  cardBody: { padding: 16, gap: 10 },
  eventTitle: { fontSize: 17, fontWeight: '700' },
  titleWithBookmark: { paddingRight: 48 },
  bookmark: { position: 'absolute', top: 12, right: 12, zIndex: 2, width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  detail: { fontSize: 14, lineHeight: 21 },
  cardFooter: { marginTop: 4, paddingTop: 10 },
  loadMore: { padding: 14, borderWidth: 1, borderRadius: 14, marginBottom: 18, alignItems: 'center' },
});
