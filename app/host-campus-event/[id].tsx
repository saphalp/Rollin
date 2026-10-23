import { AppText } from '@/components/text';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { defaultMeetingLocal, hostCampusEvent, loadHostableCampusEvent, ownHostedActivity } from '@/lib/campus-hosting';
import { campusDateLabel, campusUpcoming, plainDescription, type CampusEvent } from '@/lib/home-campus-events';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
const categories = ['social', 'sports', 'music', 'study', 'outdoor', 'gaming'];
export default function HostCampusEventScreen() {
  const params = useLocalSearchParams<{ id: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const colors = Colors[useColorScheme() ?? 'light']; const insets = useSafeAreaInsets();
  const [event, setEvent] = useState<CampusEvent | null>(null); const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const [location, setLocation] = useState(''); const [meeting, setMeeting] = useState('');
  const [capacity, setCapacity] = useState('10'); const [category, setCategory] = useState('social');
  const [sharing, setSharing] = useState(false); const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [description, setDescription] = useState(''); const [busy, setBusy] = useState(false);
  const busyRef = useRef(false); const generation = useRef(0);
  useEffect(() => {
    let active = true; let identity: string | undefined;
    async function load() {
      const request = ++generation.current; setLoading(true); setEvent(null); setError('');
      try {
        if (!id) throw new Error('Missing event ID.');
        const auth = await supabase.auth.getUser();
        if (auth.error || !auth.data.user) throw new Error('Sign in before hosting.');
        const result = await loadHostableCampusEvent(id);
        const existing = await ownHostedActivity(id, auth.data.user.id);
        if (!active || request !== generation.current) return;
        if (existing) { router.replace(`/activity/${existing}`); return; }
        if (!campusUpcoming(result.event, Date.now())) throw new Error('This campus event has ended or was canceled.');
        setUserId(auth.data.user.id); setEvent(result.event);
        setLocation([result.event.location, result.event.room].filter(Boolean).join(' · '));
        setMeeting(defaultMeetingLocal(result.event)); setDescription(plainDescription(result.event.description ?? '').slice(0, 10000));
        setCapacity('10'); setSharing(false); setVisibility('public');
        const labels = [result.event.category, ...result.event.tags].join(' ').toLowerCase();
        setCategory(labels.includes('sport') || labels.includes('athletic') ? 'sports' : labels.includes('music') ? 'music' : 'social');
      } catch (err) { if (active && request === generation.current) setError(err instanceof Error ? err.message : 'Unable to load event.'); }
      finally { if (active && request === generation.current) setLoading(false); }
    }
    void load();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const key = `${session?.user.id ?? ''}:${session?.user.email ?? ''}:${session?.user.email_confirmed_at ?? ''}`;
      if (key === identity) return;
      identity = key; ++generation.current; setEvent(null); setUserId('');
      setTimeout(() => { if (active) void load(); }, 0);
    });
    return () => { active = false; ++generation.current; subscription.unsubscribe(); };
  }, [id]);
  async function publish() {
    if (busyRef.current || !event || !userId) return;
    if (!location.trim() || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(meeting.trim()) || !/^\d+$/.test(capacity) || Number(capacity) < 1 || Number(capacity) > 10000) {
      setError('Enter a meeting place, date/time as YYYY-MM-DD HH:mm, and capacity from 1 to 10000.'); return;
    }
    busyRef.current = true; setBusy(true); setError('');
    const request = generation.current; const eventSnapshot = event; const owner = userId;
    try {
      let coordinate: { latitude: number; longitude: number } | undefined;
      if (Platform.OS !== 'web') {
        try {
          const permission = Platform.OS === 'android' ? await Location.requestForegroundPermissionsAsync() : { granted: true };
          if (permission.granted) coordinate = (await Location.geocodeAsync(location.trim()))[0];
        } catch { /* The activity can still use its written meeting address. */ }
      }
      if (request !== generation.current) throw new Error('Account changed; reopen the event before hosting.');
      const activityId = await hostCampusEvent(eventSnapshot, owner, { meetingLocal: meeting, location, category, capacity: Number(capacity), sharing, visibility, description, latitude: coordinate?.latitude ?? null, longitude: coordinate?.longitude ?? null });
      if (request !== generation.current) return;
      Alert.alert('Activity created', 'Your hosted event is now a regular activity.');
      router.replace(`/activity/${activityId}`);
    } catch (err) { if (request === generation.current) setError(err instanceof Error ? err.message : 'Unable to host. Please retry.'); }
    finally { busyRef.current = false; setBusy(false); }
  }
  const input = (label: string, value: string, onChangeText: (value: string) => void, multiline = false) => <View style={styles.field}><AppText>{label}</AppText><TextInput accessibilityLabel={label} value={value} onChangeText={onChangeText} editable={!busy} multiline={multiline} autoCapitalize="none" autoCorrect={false} maxLength={multiline ? 10000 : label === 'Meeting location' ? 500 : 50} keyboardType={label === 'Maximum attendees' ? 'number-pad' : 'default'} style={[styles.input, { color: colors.text, borderColor: colors.outlineVariant }]} /></View>;
  return <View style={[styles.screen, { backgroundColor: colors.background, paddingTop: insets.top }]}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back" disabled={busy} onPress={() => router.canGoBack() ? router.back() : router.replace('/campus-events')} style={styles.backButton}><Ionicons name="chevron-back" size={26} color={colors.tint} /></Pressable>
      <AppText style={styles.title}>Host Event</AppText>
      {loading && <ActivityIndicator />}
      {!!error && <AppText accessibilityRole="alert" style={{ color: colors.error }}>{error}</AppText>}
      {event && <>
        <AppText style={styles.heading}>{event.title}</AppText><AppText>{campusDateLabel(event)}</AppText>
        <AppText>Organize your own group attending this event. You’ll be the activity host.</AppText>
        {input('Meeting location', location, setLocation)}
        {input(`Meeting date/time (${event.time_zone ?? 'America/Chicago'}; YYYY-MM-DD HH:mm)`, meeting, setMeeting)}
        {input('Maximum attendees', capacity, setCapacity)}
        <AppText>Category</AppText><View style={styles.row}>{categories.map(value => <Pressable key={value} disabled={busy} onPress={() => setCategory(value)} style={[styles.chip, { borderColor: colors.tint, backgroundColor: category === value ? colors.tint : colors.background }]}><AppText style={{ color: category === value ? colors.onImageOverlay : colors.tint, textTransform: 'capitalize' }}>{value}</AppText></Pressable>)}</View>
        <View style={styles.toggle}><AppText>Ride sharing available</AppText><Switch accessibilityLabel="Ride sharing available" value={sharing} onValueChange={setSharing} disabled={busy} /></View>
        <View style={styles.toggle}><AppText>Private activity</AppText><Switch accessibilityLabel="Private activity" value={visibility === 'private'} onValueChange={value => setVisibility(value ? 'private' : 'public')} disabled={busy} /></View>
        <AppText>{visibility === 'private' ? 'Uses your normal private-activity visibility rules.' : 'Shows on Home using the normal public-activity rules.'}</AppText>
        {input('About your activity', description, setDescription, true)}
        <Pressable accessibilityRole="button" disabled={busy} onPress={() => void publish()} style={[styles.publish, { backgroundColor: colors.tint, opacity: busy ? 0.5 : 1 }]}><AppText style={{ color: colors.onImageOverlay, fontWeight: '700' }}>{busy ? 'Creating…' : 'Host Event'}</AppText></Pressable>
      </>}
    </ScrollView>
  </View>;
}
const styles = StyleSheet.create({ screen: { flex: 1 }, content: { padding: 20, gap: 18 }, backButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' }, title: { fontSize: 25, fontWeight: '700' }, heading: { fontSize: 20, fontWeight: '700' }, field: { gap: 8 }, input: { padding: 12, borderWidth: 1, borderRadius: 12, fontSize: 15 }, row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, chip: { padding: 10, borderWidth: 1, borderRadius: 20 }, toggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, publish: { padding: 16, borderRadius: 28, alignItems: 'center' } });
