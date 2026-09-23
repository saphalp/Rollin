import { useLocalSearchParams, router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText } from '@/components/text';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { myRatings, ratingTargets, RatingTarget, RideRating, saveRating } from '@/services/ride-ratings-service';

function RatingForm({ target, existing }: { target: RatingTarget; existing?: RideRating }) {
  const colors = Colors[useColorScheme() ?? 'light'];
  const [stars, setStars] = useState(existing?.stars ?? 0);
  const [comment, setComment] = useState(existing?.comment ?? '');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(Boolean(existing));
  async function submit() {
    setBusy(true);
    try { await saveRating(target, stars, comment); setSaved(true); }
    catch (e) { Alert.alert('Could not save rating', e instanceof Error ? e.message : 'Try again.'); }
    finally { setBusy(false); }
  }
  return <View style={{ padding: 16, borderRadius: 16, backgroundColor: colors.cardBackground, gap: 12 }}>
    <AppText style={{ fontWeight: '700', fontSize: 18 }}>{target.name}</AppText>
    <View style={{ flexDirection: 'row', gap: 12 }}>{[1,2,3,4,5].map(n =>
      <TouchableOpacity key={n} disabled={busy} accessibilityRole="button" accessibilityLabel={`${n} stars`}
        accessibilityState={{ selected: n === stars }} onPress={() => { setStars(n); setSaved(false); }}>
        <AppText style={{ fontSize: 34, color: colors.tint }}>{n <= stars ? '★' : '☆'}</AppText>
      </TouchableOpacity>)}</View>
    <TextInput accessibilityLabel="Optional rating comment" placeholder="Comment (optional)" placeholderTextColor={colors.icon}
      multiline maxLength={1000} editable={!busy} value={comment} onChangeText={v => { setComment(v); setSaved(false); }}
      style={{ color: colors.text, borderWidth: 1, borderColor: colors.outlineVariant, padding: 12, borderRadius: 12, minHeight: 90 }} />
    <AppText style={{ fontSize: 12 }}>Only you and the recipient can read this comment.</AppText>
    <TouchableOpacity disabled={!stars || busy || saved} onPress={() => void submit()} accessibilityRole="button"
      style={{ backgroundColor: colors.tint, padding: 14, borderRadius: 12, opacity: !stars || saved ? 0.5 : 1 }}>
      <AppText style={{ color: colors.onPrimary, textAlign: 'center' }}>{busy ? 'Saving…' : saved ? 'Saved' : 'Save rating'}</AppText>
    </TouchableOpacity>
  </View>;
}

export default function RideRatingsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = Colors[useColorScheme() ?? 'light'];
  const [targets, setTargets] = useState<RatingTarget[]>([]);
  const [ratings, setRatings] = useState<RideRating[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { const [t, r] = await Promise.all([ratingTargets(id), myRatings(id)]); setTargets(t); setRatings(r); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not load ratings.'); }
    finally { setLoading(false); }
  }, [id]);
  useEffect(() => { void load(); }, [load]);
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, gap: 16 }}>
      <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/rides')}><AppText>← Back</AppText></TouchableOpacity>
      <AppText style={{ fontSize: 24, fontWeight: '700' }}>Rate your ride</AppText>
      <AppText>You can add or edit these ratings later from ride history.</AppText>
      {loading ? <ActivityIndicator /> : error ? <TouchableOpacity onPress={() => void load()}><AppText>{error} Tap to retry.</AppText></TouchableOpacity>
        : targets.length ? targets.map(t => <RatingForm key={t.recipient_id} target={t} existing={ratings.find(r => r.recipient_id === t.recipient_id)} />)
          : <AppText>No participants to rate for this ride. Ratings are available after a completed trip.</AppText>}
    </ScrollView>
  </SafeAreaView>;
}
