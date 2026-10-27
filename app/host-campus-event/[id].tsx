import { DateTimeField } from '@/components/post/date-time-field';
import { LocationAutocompleteField, type PlaceSelection } from '@/components/post/location-autocomplete-field';
import { AppText } from '@/components/text';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { defaultMeetingLocal, hostCampusEvent, loadHostableCampusEvent, ownHostedActivity } from '@/lib/campus-hosting';
import { campusDateLabel, campusUpcoming, plainDescription, type CampusEvent } from '@/lib/home-campus-events';
import { supabase } from '@/lib/supabase';
import * as Location from 'expo-location';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackButton } from '@/components/ui/back-button';
const categories = ['social', 'sports', 'music', 'study', 'outdoor', 'gaming'];

// host_campus_event expects wall-clock time in the event's time zone:
// YYYY-MM-DD HH:mm. A local Date is used only to drive the native pickers.
function parseMeeting(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const [, y, m, d, hour, minute] = match.map(Number);
  const date = new Date(y, m - 1, d, hour, minute);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d
    && date.getHours() === hour && date.getMinutes() === minute ? date : null;
}
function formatMeeting(value: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())} ${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

export default function HostCampusEventScreen() {
  const params = useLocalSearchParams<{ id: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const colors = Colors[useColorScheme() ?? 'light']; const insets = useSafeAreaInsets();
  const [event, setEvent] = useState<CampusEvent | null>(null); const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const [location, setLocation] = useState(''); const [meeting, setMeeting] = useState('');
  const [officialLocationMissing, setOfficialLocationMissing] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<PlaceSelection | null>(null);
  const [capacity, setCapacity] = useState('10'); const [category, setCategory] = useState('social');
  const [sharing, setSharing] = useState(false); const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [description, setDescription] = useState(''); const [aboutExpanded, setAboutExpanded] = useState(false); const [busy, setBusy] = useState(false);
  const busyRef = useRef(false); const generation = useRef(0);
  const meetingDate = parseMeeting(meeting);
  const currentPickerDate = () => parseMeeting(meeting) ?? new Date();
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
        const officialVenue = [result.event.location, result.event.room].filter(Boolean).join(' · ');
        setLocation(officialVenue);
        setOfficialLocationMissing(!officialVenue.trim());
        setSelectedPlace(null);
        setMeeting(defaultMeetingLocal(result.event)); setDescription(plainDescription(result.event.description ?? '').slice(0, 10000)); setAboutExpanded(false);
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
    if (!location.trim() || !parseMeeting(meeting.trim()) || !/^\d+$/.test(capacity) || Number(capacity) < 1 || Number(capacity) > 10000) {
      setError('Choose a meeting location, a valid date and time, and capacity from 1 to 10000.'); return;
    }
    busyRef.current = true; setBusy(true); setError('');
    const request = generation.current; const eventSnapshot = event; const owner = userId;
    try {
      // Prefer the exact coordinates selected by the existing Post autocomplete.
      // Manual/prefilled values still use the previous geocoding fallback.
      let coordinate: { latitude: number; longitude: number } | undefined = selectedPlace
        ? { latitude: selectedPlace.latitude, longitude: selectedPlace.longitude }
        : undefined;
      if (!coordinate && Platform.OS !== 'web') {
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
  const input = (label: string, value: string, onChangeText: (value: string) => void, multiline = false) => <View style={styles.field}><AppText>{label}</AppText><TextInput accessibilityLabel={label} value={value} onChangeText={onChangeText} editable={!busy} multiline={multiline} autoCapitalize="none" autoCorrect={false} maxLength={multiline ? 10000 : label.startsWith('Meeting location') || label.startsWith('Meeting address') ? 500 : 50} keyboardType={label === 'Maximum attendees' ? 'number-pad' : 'default'} style={[styles.input, { color: colors.text, borderColor: colors.outlineVariant }]} /></View>;
  return <View style={[styles.screen, { backgroundColor: colors.background, paddingTop: insets.top }]}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
      <BackButton disabled={busy} fallbackHref="/campus-events" />
      <AppText style={styles.title}>Host Event</AppText>
      {loading && <ActivityIndicator />}
      {!!error && <AppText accessibilityRole="alert" style={{ color: colors.error }}>{error}</AppText>}
      {event && <>
        <AppText style={styles.heading}>{event.title}</AppText><AppText>{campusDateLabel(event)}</AppText>
        <AppText>Organize your own group attending this event. You’ll be the activity host.</AppText>
        <View style={styles.field}>
          {officialLocationMissing && (
            <AppText style={{ color: colors.outline }}>
              The university did not provide an event venue. Search for a meeting place or address.
            </AppText>
          )}
          <LocationAutocompleteField
            label="Meeting location"
            value={location}
            onChangeText={(text) => { setLocation(text); setSelectedPlace(null); }}
            onPlaceSelect={(place) => { setLocation(place.displayText); setSelectedPlace(place); }}
            placeholder="Search a building, venue, or street address"
          />
        </View>
        <View style={styles.field}>
          <AppText style={styles.sectionTitle}>Meeting date and time</AppText>
          <AppText style={{ color: colors.outline }}>
            Event time zone: {event.time_zone ?? 'America/Chicago'}
          </AppText>
          <View style={styles.dateTimeRow}>
            <View style={styles.dateTimeItem}>
              <DateTimeField
                label="Date"
                mode="date"
                value={meetingDate}
                placeholder="Select date"
                minimumDate={new Date()}
                onChange={(selected) => {
                  const next = currentPickerDate();
                  next.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
                  setMeeting(formatMeeting(next));
                }}
              />
            </View>
            <View style={styles.dateTimeItem}>
              <DateTimeField
                label="Time"
                mode="time"
                value={meetingDate}
                placeholder="Select time"
                onChange={(selected) => {
                  const next = currentPickerDate();
                  next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
                  setMeeting(formatMeeting(next));
                }}
              />
            </View>
          </View>
        </View>
        {input('Maximum attendees', capacity, setCapacity)}
        <AppText>Category</AppText><View style={styles.row}>{categories.map(value => <Pressable key={value} disabled={busy} onPress={() => setCategory(value)} style={[styles.chip, { borderColor: colors.tint, backgroundColor: category === value ? colors.tint : colors.background }]}><AppText style={{ color: category === value ? colors.onImageOverlay : colors.tint, textTransform: 'capitalize' }}>{value}</AppText></Pressable>)}</View>
        <View style={styles.toggle}><AppText>Ride sharing available</AppText><Switch accessibilityLabel="Ride sharing available" value={sharing} onValueChange={setSharing} disabled={busy} /></View>
        <View style={styles.toggle}><AppText>Private activity</AppText><Switch accessibilityLabel="Private activity" value={visibility === 'private'} onValueChange={value => setVisibility(value ? 'private' : 'public')} disabled={busy} /></View>
        <AppText>{visibility === 'private' ? 'Uses your normal private-activity visibility rules.' : 'Shows on Home using the normal public-activity rules.'}</AppText>
        <View style={[styles.aboutBox, { backgroundColor: colors.cardBackground, borderColor: colors.outlineVariant }]}>
          <AppText style={styles.aboutHeading}>About your activity</AppText>
          {aboutExpanded ? (
            <TextInput
              accessibilityLabel="About your activity description"
              value={description}
              onChangeText={setDescription}
              editable={!busy}
              multiline
              scrollEnabled
              textAlignVertical="top"
              maxLength={10000}
              placeholder="Add details about your activity"
              placeholderTextColor={colors.outline}
              style={[styles.aboutEditor, { color: colors.text, borderColor: colors.outlineVariant }]}
            />
          ) : (
            <AppText numberOfLines={3} style={styles.aboutPreview}>
              {description.trim() || 'Add details about your activity.'}
            </AppText>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={aboutExpanded ? 'Show less description' : 'Show more and edit description'}
            disabled={busy}
            onPress={() => setAboutExpanded(current => !current)}
            style={styles.aboutToggle}
          >
            <AppText style={{ color: colors.tint, fontWeight: '700' }}>
              {aboutExpanded ? 'Show less' : description.length > 160 ? 'Show more...' : 'Edit description'}
            </AppText>
          </Pressable>
        </View>
        <Pressable accessibilityRole="button" disabled={busy} onPress={() => void publish()} style={[styles.publish, { backgroundColor: colors.tint, opacity: busy ? 0.5 : 1 }]}><AppText style={{ color: colors.onImageOverlay, fontWeight: '700' }}>{busy ? 'Creating…' : 'Host Event'}</AppText></Pressable>
      </>}
    </ScrollView>
  </View>;
}
const styles = StyleSheet.create({ aboutBox: { borderWidth: 1, borderRadius: 14, padding: 16, gap: 10 }, aboutHeading: { fontSize: 20, fontWeight: '700' }, aboutPreview: { fontSize: 15, lineHeight: 23 }, aboutEditor: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 15, minHeight: 170, maxHeight: 170 }, aboutToggle: { alignSelf: 'flex-start', paddingVertical: 4 }, screen: { flex: 1 }, content: { padding: 20, gap: 18 }, backButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' }, title: { fontSize: 25, fontWeight: '700' }, heading: { fontSize: 20, fontWeight: '700' }, field: { gap: 8 }, input: { padding: 12, borderWidth: 1, borderRadius: 12, fontSize: 15 }, row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, dateTimeRow: { flexDirection: 'row', gap: 12 }, dateTimeItem: { flex: 1, minWidth: 0 }, sectionTitle: { fontSize: 17, fontWeight: '700' }, chip: { padding: 10, borderWidth: 1, borderRadius: 20 }, toggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, publish: { padding: 16, borderRadius: 28, alignItems: 'center' } });
