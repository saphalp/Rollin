import { useCallback, useEffect, useRef, useState } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/components/text';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { supabase } from '@/lib/supabase';
import { getCurrentUniversity, type University } from '@/lib/university';
import { campusDateLabel, campusSortKey, campusUpcoming, uniqueCampusEvents, type CampusEvent } from '@/lib/home-campus-events';
import { isAcademicCalendar } from '@/lib/home-feed';

export default function CampusEventsScreen() {
  const colors = Colors[useColorScheme() ?? 'light'];
  const insets = useSafeAreaInsets();
  const [university, setUniversity] = useState<University | null>(null);
  const [events, setEvents] = useState<CampusEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [past, setPast] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const generation = useRef(0);
  const reload = useCallback(async () => {
    const request = ++generation.current;
    setLoading(true); setError('');
    try {
      const campus = await getCurrentUniversity();
      if (request !== generation.current) return;
      if (!campus?.calendar_enabled) { setEvents([]); setUniversity(campus); throw new Error('Verify your supported university email to view its calendar.'); }
      const rows: CampusEvent[] = [];
      for (let offset = 0; ; offset += 500) {
        const result = await supabase.from('campus_events').select('*').eq('campus', campus.id).order('id').range(offset, offset + 499);
        if (request !== generation.current) return;
        if (result.error) throw result.error;
        rows.push(...(result.data ?? []) as CampusEvent[]);
        if ((result.data?.length ?? 0) < 500) break;
      }
      setNow(Date.now()); setUniversity(campus); setEvents(uniqueCampusEvents(rows).filter(e => !isAcademicCalendar(e)));
    } catch (err) {
      if (request === generation.current) { setEvents([]); setError(err instanceof Error ? err.message : 'Unable to load campus events. Pull down to retry.'); }
    } finally { if (request === generation.current) setLoading(false); }
  }, []);
  useEffect(() => {
    let active = true; let identity: string | undefined;
    void reload();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const key = `${session?.user.id ?? ''}:${session?.user.email ?? ''}:${session?.user.email_confirmed_at ?? ''}`;
      if (key === identity) return;
      identity = key; ++generation.current; setEvents([]); setUniversity(null);
      setTimeout(() => { if (active) void reload(); }, 0);
    });
    return () => { active = false; ++generation.current; subscription.unsubscribe(); };
  }, [reload]);
  const visible = events.filter(e => !['CANCELED','CANCELLED'].includes(e.status.toUpperCase())
    && campusUpcoming(e, now) !== past
    && `${e.title} ${e.location ?? ''} ${e.room ?? ''}`.toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a,b) => (past ? -1 : 1) * campusSortKey(a).localeCompare(campusSortKey(b)) || a.id.localeCompare(b.id));
  return <View style={[styles.screen, { backgroundColor: colors.background, paddingTop: insets.top }]}>
    <View style={styles.header}>
      <Pressable accessibilityRole="button" onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')}><AppText style={{ color: colors.tint }}>‹ Back</AppText></Pressable>
      <AppText style={styles.title}>Campus Event</AppText>
    </View>
    <FlatList data={visible} keyExtractor={item => item.id} contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} />}
      ListHeaderComponent={<View style={styles.filters}>
        <AppText>{university?.short_name ?? 'Your university'} · Calendar events</AppText>
        <AppText>Open an event to host an activity with your friends.</AppText>
        <TextInput accessibilityLabel="Search campus events" placeholder="Search events or location" placeholderTextColor={colors.outline} value={search} onChangeText={setSearch} style={[styles.input, { color: colors.text, borderColor: colors.outlineVariant }]} />
        <View style={styles.row}>{['Upcoming','Past'].map((label,index) => <Pressable key={label} accessibilityRole="button" accessibilityState={{ selected: past === !!index }} onPress={() => setPast(!!index)} style={[styles.chip, { borderColor: colors.tint, backgroundColor: past === !!index ? colors.tint : colors.background }]}><AppText style={{ color: past === !!index ? colors.onImageOverlay : colors.tint }}>{label}</AppText></Pressable>)}</View>
        {!!error && <View><AppText accessibilityRole="alert" style={{ color: colors.error }}>{error}</AppText><Pressable onPress={() => void reload()}><AppText>Retry</AppText></Pressable></View>}
        <AppText>{visible.length} events</AppText>
      </View>}
      ListEmptyComponent={loading ? <ActivityIndicator /> : !error ? <AppText>No campus events found.</AppText> : null}
      renderItem={({ item }) => <Pressable accessibilityRole="button" onPress={() => router.push(`/campus-event/${item.id}`)} style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.outlineVariant }]}>
        <AppText style={styles.eventTitle}>{item.title}</AppText>
        <AppText>{campusDateLabel(item)}</AppText>
        <AppText>{[item.location,item.room].filter(Boolean).join(' · ') || 'Location not provided'}</AppText>
        <AppText style={{ color: colors.tint }}>View event</AppText>
      </Pressable>} />
  </View>;
}
const styles = StyleSheet.create({ screen: { flex: 1 }, header: { padding: 20, flexDirection: 'row', alignItems: 'center', gap: 20 }, title: { fontSize: 22, fontWeight: '700' }, list: { paddingHorizontal: 20, flexGrow: 1 }, filters: { gap: 12, marginBottom: 18 }, row: { flexDirection: 'row', gap: 12 }, chip: { borderWidth: 1, borderRadius: 20, padding: 12 }, input: { borderWidth: 1, borderRadius: 14, padding: 12 }, card: { borderWidth: 1, borderRadius: 14, padding: 16, gap: 10, marginBottom: 14 }, eventTitle: { fontSize: 17, fontWeight: '700' } });
