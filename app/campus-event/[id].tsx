import { AppText } from '@/components/text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { AppView } from '@/components/view';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { CampusEvent } from '@/lib/home-campus-events';
import { campusDateLabel, campusUpcoming, plainDescription } from '@/lib/home-campus-events';
import { supabase } from '@/lib/supabase';
import { Image } from 'expo-image';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Linking, RefreshControl, ScrollView, Share, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// The sync function stores official LA Tech URLs. Never open an arbitrary scheme.
function officialLink(value: string): string | null {
  return /^https:\/\/www\.latech\.edu(?:\/|$)/i.test(value) ? value : null;
}

export default function CampusEventDetailScreen() {
  const params = useLocalSearchParams<{ id: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const colors = Colors[useColorScheme() ?? 'light'];
  const insets = useSafeAreaInsets();
  const [event, setEvent] = useState<CampusEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [now, setNow] = useState(Date.now());
  const [imageFailed, setImageFailed] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [going, setGoing] = useState(false);
  const [attendeeCount, setAttendeeCount] = useState<number | null>(null);
  const [attendanceError, setAttendanceError] = useState('');
  const [joinBusy, setJoinBusy] = useState(false);
  const mutationBusy = useRef(false);
  const generation = useRef(0);
  const loadedImage = useRef<string | null>(null);
  const back = () => { if (router.canGoBack()) router.back(); else router.replace('/'); };

  const load = useCallback(async () => {
    const request = ++generation.current;
    const current = () => request === generation.current;
    setLoading(true); setMessage(''); setAttendanceError('');
    try {
      if (!id) throw new Error('This event link is missing its ID.');
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (!current()) return;
      if (authError) throw authError;
      setCurrentUserId(user?.id ?? null);
      if (!user) { setEvent(null); setMessage('Sign in with a verified LA Tech email to view this event.'); return; }
      const { data: allowed, error: accessError } = await supabase.rpc('can_view_latech_events');
      if (!current()) return;
      if (accessError) throw accessError;
      if (allowed !== true) {
        setEvent(null); setMessage('A verified @latech.edu or @email.latech.edu account is required.'); return;
      }
      const { data, error } = await supabase.from('campus_events').select('*')
        .eq('campus', 'latech').eq('id', id).maybeSingle();
      if (!current()) return;
      if (error) throw error;
      if (!data) { setEvent(null); setMessage('This campus event is no longer available.'); return; }
      const next = data as CampusEvent;
      if (loadedImage.current !== next.image_url) {
        loadedImage.current = next.image_url; setImageFailed(false);
      }
      setEvent(next); setNow(Date.now());
      const stats = await supabase.rpc('campus_event_attendance', { event_ids: [next.id] });
      if (!current()) return;
      if (stats.error || !stats.data?.length) {
        setAttendeeCount(null); setGoing(false);
        setAttendanceError('Attendance is temporarily unavailable. Pull down to refresh.');
      } else {
        setAttendeeCount(Number(stats.data[0].attendee_count));
        setGoing(stats.data[0].going === true);
      }
    } catch {
      if (current()) {
        setEvent(null); setMessage('Unable to load this campus event. Check your connection and try again.');
      }
    } finally { if (current()) setLoading(false); }
  }, [id]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));
  useEffect(() => {
    let active = true;
    let accountId: string | null | undefined;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((authEvent, session) => {
      const nextId = session?.user.id ?? null;
      if (nextId === accountId && authEvent !== 'USER_UPDATED') return;
      accountId = nextId;
      ++generation.current; setEvent(null); setLoading(true); setMessage('');
      setCurrentUserId(null); setGoing(false); setAttendeeCount(null); setAttendanceError(''); setAttendanceError('');
      setTimeout(() => { if (active) void load(); }, 0);
    });
    const foreground = AppState.addEventListener('change', state => {
      if (state === 'active') void load();
    });
    const refresh = setInterval(() => {
      if (AppState.currentState === 'active') void load();
    }, 5 * 60_000);
    const clock = setInterval(() => setNow(Date.now()), 30_000);
    return () => {
      active = false; ++generation.current; subscription.unsubscribe();
      foreground.remove(); clearInterval(refresh); clearInterval(clock);
    };
  }, [load]);

  async function toggleJoin() {
    if (!event || !currentUserId || attendeeCount === null || mutationBusy.current) return;
    if (!going && !campusUpcoming(event, Date.now())) return;
    const joined = going;
    const eventId = event.id;
    const userId = currentUserId;
    const request = generation.current;
    mutationBusy.current = true; setJoinBusy(true);
    try {
      // Recheck the account before writing; RLS also enforces ownership and access.
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || user?.id !== userId) throw new Error('Please sign in again before joining.');
      const result = joined
        ? await supabase.from('campus_event_rsvps').delete().eq('event_id', eventId).eq('user_id', userId)
        : await supabase.from('campus_event_rsvps').insert({ event_id: eventId, user_id: userId });
      // Another device may already have joined. The primary key prevents duplicates.
      if (result.error && !(result.error.code === '23505' && !joined)) throw result.error;
      if (request === generation.current) await load();
    } catch (error) {
      if (request === generation.current) Alert.alert(joined ? 'Could not leave activity' : 'Could not join activity',
        error && typeof error === 'object' && 'message' in error ? String(error.message) : 'Please refresh and try again.');
    } finally { mutationBusy.current = false; setJoinBusy(false); }
  }
  function handleJoin() {
    if (going) Alert.alert('Leave activity?', 'Remove your Going status for this campus event?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: () => void toggleJoin() },
    ]);
    else void toggleJoin();
  }

  const openOfficial = async () => {
    const url = event && officialLink(event.official_url);
    if (!url) { Alert.alert('Unavailable', 'The official event link is invalid.'); return; }
    try { await Linking.openURL(url); }
    catch { Alert.alert('Unable to open link', 'Please try again.'); }
  };
  const shareEvent = async () => {
    if (!event) return;
    const url = officialLink(event.official_url);
    if (!url) { Alert.alert('Unavailable', 'The official event link is invalid.'); return; }
    try { await Share.share({ title: event.title, message: `${event.title}\n${campusDateLabel(event)}\n${url}` }); }
    catch { Alert.alert('Unable to share', 'Please try again.'); }
  };

  if (!event) return (
    <AppView style={[styles.centered, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <Stack.Screen options={{ headerShown: false }} />
      {loading ? <ActivityIndicator color={colors.tint} /> : <>
        <AppText style={{ color: colors.text, textAlign: 'center' }}>{message}</AppText>
        <TouchableOpacity accessibilityRole="button" onPress={() => void load()}><AppText style={{ color: colors.tint }}>Try again</AppText></TouchableOpacity>
      </>}
      <TouchableOpacity accessibilityRole="button" onPress={back}><AppText style={{ color: colors.tint }}>Back</AppText></TouchableOpacity>
    </AppView>
  );
  const cancelled = ['CANCELLED', 'CANCELED'].includes(event.status.toUpperCase());
  const past = !cancelled && !campusUpcoming(event, now);
  const location = [event.location, event.room].filter(Boolean).join(' · ');
  return (
    <AppView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView style={{ backgroundColor: colors.background }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 150 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}>
        <View style={[styles.heroContainer, { backgroundColor: colors.primaryContainer }]}>
          {event.image_url && !imageFailed ? <Image source={{ uri: event.image_url }} style={styles.hero}
            contentFit="cover" cachePolicy="memory-disk" onError={() => setImageFailed(true)} />
            : <View style={styles.heroFallback}><AppText style={{ color: colors.text, fontSize: 24, fontWeight: '700' }}>LA Tech</AppText>
              <AppText style={{ color: colors.text }}>Campus Event</AppText></View>}
          <View style={[styles.heroOverlay, { paddingTop: insets.top + 8 }]}>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Go back" onPress={back}
              style={[styles.roundButton, { backgroundColor: colors.background }]}>
              <IconSymbol name="chevron.left" size={20} color={colors.text} />
            </TouchableOpacity>
            <View style={styles.heroRightGroup}>
              <View style={[styles.badge, { backgroundColor: colors.tint }]}>
                <AppText style={[styles.badgeText, { color: colors.onImageOverlay, fontFamily: Fonts?.sans }]}>Campus Event</AppText>
              </View>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="Share campus event" onPress={() => void shareEvent()}
                style={[styles.roundButton, { backgroundColor: colors.background }]}>
                <IconSymbol name="square.and.arrow.up" size={18} color={colors.text} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
        <View style={styles.body}>
          <AppText style={[styles.title, { color: colors.text, fontFamily: Fonts?.sans }]}>{event.title}</AppText>
          <View style={styles.organizerRow}>
            <View style={[styles.organizerIcon, { backgroundColor: colors.tint }]}>
              <IconSymbol name="calendar" size={22} color={colors.onImageOverlay} />
            </View>
            <View style={{ flex: 1 }}>
              <AppText style={{ color: colors.outline, fontSize: 12 }}>Official campus calendar</AppText>
              <AppText style={{ color: colors.text, fontSize: 16, fontWeight: '600', marginTop: 2 }}>LA Tech · Campus Event</AppText>
            </View>
          </View>
          {(cancelled || past) && <AppText style={{ color: colors.text }}>{cancelled ? 'This event has been cancelled.' : 'This event has ended.'}</AppText>}
          <View style={[styles.metaCard, { backgroundColor: colors.surfaceContainerHigh, borderColor: colors.outlineVariant }]}>
            <View style={styles.metaRow}>
              <IconSymbol name="calendar" size={20} color={colors.tint} />
              <AppText style={[styles.metaText, { color: colors.text }]}>{campusDateLabel(event)}{event.date_only ? ' · Central Time' : ''}</AppText>
            </View>
            <View style={[styles.divider, { backgroundColor: colors.outlineVariant }]} />
            <View style={styles.metaRow}>
              <IconSymbol name="mappin" size={20} color={colors.tint} />
              <AppText style={[styles.metaText, { color: colors.text }]}>{location || 'Location not provided'}</AppText>
            </View>
            {attendeeCount !== null && <>
              <View style={[styles.divider, { backgroundColor: colors.outlineVariant }]} />
              <View style={styles.metaRow}>
                <IconSymbol name="person.2.fill" size={20} color={colors.tint} />
                <AppText style={[styles.metaText, { color: colors.text }]}>{attendeeCount} joined</AppText>
              </View>
            </>}
            {!!event.category && <>
              <View style={[styles.divider, { backgroundColor: colors.outlineVariant }]} />
              <View style={styles.metaRow}><AppText style={[styles.metaText, { color: colors.text }]}>{event.category}</AppText></View>
            </>}
          </View>
          {!!attendanceError && <AppText accessibilityRole="alert" style={{ color: colors.text }}>{attendanceError}</AppText>}
          <View style={{ gap: 8 }}>
            <AppText style={{ color: colors.text, fontSize: 18, fontWeight: '700' }}>About</AppText>
            <AppText style={{ color: colors.outline, fontSize: 15, lineHeight: 24 }}>{plainDescription(event.description ?? '') || 'Visit the official event listing for more details.'}</AppText>
          </View>
        </View>
      </ScrollView>
      <View style={[styles.bottomBar, { backgroundColor: colors.background, borderTopColor: colors.outlineVariant, paddingBottom: insets.bottom + 8 }]}>
        {(!past && !cancelled || going) && <TouchableOpacity accessibilityRole="button" onPress={handleJoin}
          disabled={joinBusy || loading || attendeeCount === null}
          style={[styles.officialButton, {
            backgroundColor: going ? colors.surfaceContainerHigh : colors.tint,
            borderColor: going ? colors.outline : colors.tint, borderWidth: 1,
            opacity: joinBusy || loading || attendeeCount === null ? 0.6 : 1
          }]}>
          {going && <IconSymbol name="checkmark" size={18} color={colors.text} />}
          <AppText style={{ color: going ? colors.text : colors.onPrimary, fontSize: 15, fontWeight: '700' }}>{joinBusy ? 'Saving…' : going ? 'Going' : 'Join Activity'}</AppText>
        </TouchableOpacity>}
        <TouchableOpacity accessibilityRole="link" onPress={() => void openOfficial()} style={[styles.officialButton, { backgroundColor: colors.background, borderColor: colors.outline, borderWidth: 1 }]}>
          <AppText style={{ color: colors.text, fontFamily: Fonts?.sans, fontSize: 15, fontWeight: '700' }}>View Official Event</AppText>
        </TouchableOpacity>
      </View>
    </AppView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, gap: 20 },
  heroContainer: { position: 'relative' },
  hero: { width: '100%', height: 260 },
  heroFallback: { height: 260, alignItems: 'center', justifyContent: 'center', gap: 8 },
  heroOverlay: { ...StyleSheet.absoluteFill, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 16, paddingBottom: 12 },
  heroRightGroup: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  roundButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', opacity: 0.9 },
  badge: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
  badgeText: { fontSize: 13, fontWeight: '600' },
  body: { padding: 20, gap: 20 },
  title: { fontSize: 26, fontWeight: '700', lineHeight: 32 },
  organizerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  organizerIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  metaCard: { borderRadius: 16, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  metaText: { fontSize: 15, flex: 1 },
  divider: { height: StyleSheet.hairlineWidth },
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  officialButton: { flex: 1, flexDirection: 'row', gap: 8, minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 24, paddingHorizontal: 16 },
});