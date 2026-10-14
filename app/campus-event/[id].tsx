import { AppText } from '@/components/text';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { loadHostableCampusEvent, ownHostedActivity } from '@/lib/campus-hosting';
import { campusDateLabel, campusUpcoming, plainDescription, type CampusEvent } from '@/lib/home-campus-events';
import { supabase } from '@/lib/supabase';
import { officialUniversityLink, type University } from '@/lib/university';
import { Image } from 'expo-image';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
export default function CampusEventDetailScreen() {
  const params = useLocalSearchParams<{ id: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const colors = Colors[useColorScheme() ?? 'light']; const insets = useSafeAreaInsets();
  const [event, setEvent] = useState<CampusEvent | null>(null); const [university, setUniversity] = useState<University | null>(null);
  const [hosted, setHosted] = useState<string>(); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const generation = useRef(0);
  const load = useCallback(async () => {
    const request = ++generation.current; setLoading(true); setError(''); setHosted(undefined);
    try {
      if (!id) throw new Error('Missing event ID.');
      const result = await loadHostableCampusEvent(id);
      const identity = await supabase.auth.getUser();
      if (identity.error) throw identity.error;
      const own = identity.data.user ? await ownHostedActivity(id, identity.data.user.id) : undefined;
      if (request !== generation.current) return;
      setNow(Date.now()); setEvent(result.event); setUniversity(result.university); setHosted(own);
    } catch (err) { if (request === generation.current) { setEvent(null); setError(err instanceof Error ? err.message : 'Unable to load event.'); } }
    finally { if (request === generation.current) setLoading(false); }
  }, [id]);
  useFocusEffect(useCallback(() => { void load(); return () => { ++generation.current; }; }, [load]));
  useEffect(() => {
    let active = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => { ++generation.current; setEvent(null); setHosted(undefined); setTimeout(() => { if (active) void load(); }, 0); });
    return () => { active = false; ++generation.current; subscription.unsubscribe(); };
  }, [load]);
  const canHost = !!event && campusUpcoming(event, now);
  return <View style={[styles.screen, { backgroundColor: colors.background }]}>
    <ScrollView refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />} contentContainerStyle={{ paddingBottom: 20 }}>
      <View style={{ paddingTop: insets.top + 12, padding: 20 }}><Pressable onPress={() => router.canGoBack() ? router.back() : router.replace('/campus-events')}><AppText style={{ color: colors.tint }}>‹ Back</AppText></Pressable></View>
      {loading && !event ? <ActivityIndicator /> : null}
      {!!error && <View style={styles.content}><AppText accessibilityRole="alert" style={{ color: colors.error }}>{error}</AppText><Pressable onPress={() => void load()}><AppText>Retry</AppText></Pressable></View>}
      {event && <>
        {event.image_url && <Image source={{ uri: event.image_url }} style={styles.hero} contentFit="cover" />}
        <View style={styles.content}>
          <AppText style={styles.title}>{event.title}</AppText>
          <AppText>{university?.short_name} · Official campus calendar</AppText>
          <View style={[styles.info, { borderColor: colors.outlineVariant }]}>
            <AppText>{campusDateLabel(event)}</AppText>
            <AppText>{[event.location, event.room].filter(Boolean).join(' · ') || 'Location not provided — choose a meeting place when hosting.'}</AppText>
          </View>
          <AppText style={styles.heading}>About</AppText>
          <AppText>{plainDescription(event.description ?? '') || 'See the official listing for details.'}</AppText>
          <AppText>Host an activity to organize your own group attending this event. Joining, attendance, rides and chat happen on that activity.</AppText>
          <Pressable onPress={() => { const url = officialUniversityLink(event.official_url, university); if (!url) { Alert.alert('Unavailable', 'The official link is invalid.'); return; } void Linking.openURL(url).catch(() => Alert.alert('Unable to open link')); }}><AppText style={{ color: colors.tint }}>View official event</AppText></Pressable>
        </View>
      </>}
    </ScrollView>
    {event && <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
      <Pressable accessibilityRole="button" disabled={!hosted && !canHost} onPress={() => hosted ? router.push(`/activity/${hosted}`) : router.push(`/host-campus-event/${event.id}`)} style={[styles.button, { backgroundColor: colors.tint, opacity: hosted || canHost ? 1 : 0.45 }]}><AppText style={{ color: colors.onImageOverlay, fontWeight: '700' }}>{hosted ? 'View Your Activity' : canHost ? 'Host Event' : 'Event ended or canceled'}</AppText></Pressable>
    </View>}
  </View>;
}
const styles = StyleSheet.create({ screen: { flex: 1 }, content: { padding: 20, gap: 18 }, hero: { height: 220, width: '100%' }, title: { fontSize: 26, fontWeight: '700' }, heading: { fontSize: 20, fontWeight: '700' }, info: { borderWidth: 1, borderRadius: 14, padding: 16, gap: 14 }, footer: { padding: 20 }, button: { padding: 16, alignItems: 'center', borderRadius: 28 } });
