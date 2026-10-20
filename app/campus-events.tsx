import { AppText } from '@/components/text';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { campusDateLabel, type CampusEvent } from '@/lib/home-campus-events';
import { supabase } from '@/lib/supabase';
import { getCurrentUniversity, type University } from '@/lib/university';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, TextInput, View } from 'react-native';
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
  const generation = useRef(0);
  const filtersRef = useRef({ past, search });
  filtersRef.current = { past, search };
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

  function loadMore() {
    if (fetching.current || loading || loadingMore || !hasMore || !university) return;
    void fetchPage(university.id, pageOffset.current, generation.current, 'append', past, search.trim());
  }

  return <View style={[styles.screen, { backgroundColor: colors.background, paddingTop: insets.top }]}>
    <View style={styles.header}>
      <Pressable accessibilityRole="button" onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')}><AppText style={{ color: colors.tint }}>‹ Back</AppText></Pressable>
      <AppText style={styles.title}>Campus Events</AppText>
    </View>
    <FlatList data={events} keyExtractor={item => item.id} contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void reload(past, search.trim())} />}
      ListHeaderComponent={<View style={styles.filters}>
        <AppText>{university?.short_name ?? 'Your university'} · Calendar events</AppText>
        <AppText>Open an event to host an activity with your friends.</AppText>
        <TextInput accessibilityLabel="Search campus events" placeholder="Search events or location" placeholderTextColor={colors.outline} value={search} onChangeText={setSearch} style={[styles.input, { color: colors.text, borderColor: colors.outlineVariant }]} />
        <View style={styles.row}>{['Upcoming', 'Past'].map((label, index) => <Pressable key={label} accessibilityRole="button" accessibilityState={{ selected: past === !!index }} onPress={() => setPast(!!index)} style={[styles.chip, { borderColor: colors.tint, backgroundColor: past === !!index ? colors.tint : colors.background }]}><AppText style={{ color: past === !!index ? colors.onImageOverlay : colors.tint }}>{label}</AppText></Pressable>)}</View>
        {!!error && <View><AppText accessibilityRole="alert" style={{ color: colors.error }}>{error}</AppText><Pressable onPress={() => void reload(past, search.trim())}><AppText style={{ color: colors.tint }}>Retry</AppText></Pressable></View>}
        <AppText>Showing {events.length} {past ? 'past' : 'upcoming'} events</AppText>
      </View>}
      ListEmptyComponent={loading ? <ActivityIndicator /> : !error ? <AppText>No campus events found.</AppText> : null}
      ListFooterComponent={hasMore ? <Pressable accessibilityRole="button" disabled={loadingMore || loading} onPress={loadMore} style={[styles.loadMore, { borderColor: colors.tint }]}>{loadingMore ? <ActivityIndicator /> : <AppText style={{ color: colors.tint, fontWeight: '700' }}>Load 10 more</AppText>}</Pressable> : null}
      renderItem={({ item }) => <Pressable accessibilityRole="button" onPress={() => router.push(`/campus-event/${item.id}`)} style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.outlineVariant }]}>
        <AppText style={styles.eventTitle}>{item.title}</AppText>
        <AppText style={styles.detail}>📅  {campusDateLabel(item)}</AppText>
        <AppText style={styles.detail}>📍  {[item.location, item.room].filter(Boolean).join(' · ') || 'Location not provided'}</AppText>
        <View style={styles.cardFooter}><AppText style={{ color: colors.tint, fontWeight: '700' }}>View event  →</AppText></View>
      </Pressable>} />
  </View>;
}
const styles = StyleSheet.create({ screen: { flex: 1 }, header: { padding: 20, flexDirection: 'row', alignItems: 'center', gap: 20 }, title: { fontSize: 22, fontWeight: '700' }, list: { paddingHorizontal: 20, flexGrow: 1 }, filters: { gap: 12, marginBottom: 18 }, row: { flexDirection: 'row', gap: 12 }, chip: { borderWidth: 1, borderRadius: 20, padding: 12 }, input: { borderWidth: 1, borderRadius: 14, padding: 12 }, card: { borderWidth: 1, borderRadius: 14, padding: 16, gap: 10, marginBottom: 14 }, eventTitle: { fontSize: 17, fontWeight: '700' }, detail: { fontSize: 14, lineHeight: 21 }, cardFooter: { marginTop: 4, paddingTop: 10 }, loadMore: { padding: 14, borderWidth: 1, borderRadius: 14, marginBottom: 18, alignItems: 'center' } });
