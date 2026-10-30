import { AppText } from '@/components/text';
import { BACK_BUTTON_SIZE, BackButton } from '@/components/ui/back-button';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { supabase } from '@/lib/supabase';
import { getCurrentUniversity, type University } from '@/lib/university';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Submit a calendar for the university resolved from the verified Auth email. */
export default function AddCampusCalendarScreen() {
  const colors = Colors[useColorScheme() ?? 'light'];
  const insets = useSafeAreaInsets();
  const [checking, setChecking] = useState(true);
  const [university, setUniversity] = useState<University | null>(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [calendarUrl, setCalendarUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        // Never use the editable profiles.university to grant submission permission.
        const verified = await getCurrentUniversity();
        if (active) setUniversity(verified);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Could not verify university.');
      } finally {
        if (active) setChecking(false);
      }
    })();
    return () => { active = false; };
  }, []);

  // Ignore spaces and punctuation, so "latech" and "LA Tech" both match.
  const normalizeUniversity = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
  const normalizedQuery = normalizeUniversity(query);
  const matches = !!university && normalizedQuery.length > 0 &&
    [university.id, university.name, university.short_name]
      .some(name => normalizeUniversity(name ?? '').includes(normalizedQuery));
  const validUrl = /^https:\/\/[^\s/?#]+(?:\/[^\s]*)?$/i.test(calendarUrl.trim());

  async function submitCalendar() {
    if (submitting || !matches || !university || !validUrl) return;
    setSubmitting(true);
    try {
      // The RPC repeats authentication, university, and URL checks server-side.
      const { error: submitError } = await supabase.rpc('submit_campus_calendar', {
        p_calendar_url: calendarUrl.trim(),
      });
      if (submitError) throw submitError;
      setSubmitted(true);
      Alert.alert('Submitted for review', 'Your campus calendar URL has been received. Events will not be imported until it is approved.');
    } catch (err) {
      Alert.alert('Submission failed', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top, backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <BackButton />
        <AppText style={[styles.heading, { color: colors.text }]}>Add Campus Calendar</AppText>
        <View style={{ width: BACK_BUTTON_SIZE }} />
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {checking ? <ActivityIndicator color={colors.tint} /> : error ?
            <AppText style={{ color: colors.error }}>{error}</AppText> : !university ? (
              <View style={styles.notice}>
                <Ionicons name="lock-closed-outline" size={26} color={colors.outline} />
                <AppText style={{ color: colors.text, fontWeight: '700' }}>Verified university email required</AppText>
                <AppText style={{ color: colors.outline }}>You can browse campus events, but only members with a recognized, verified university email can submit their university’s official calendar.</AppText>
              </View>
            ) : <>
              <AppText style={{ color: colors.outline }}>Search your university below. Only the university linked to your verified email is eligible.</AppText>
              <AppText style={[styles.label, { color: colors.text }]}>University</AppText>
              <View style={[styles.inputWrap, { borderColor: colors.outlineVariant, backgroundColor: colors.cardBackground }]}>
                <Ionicons name="search" size={20} color={colors.outline} />
                <TextInput value={query} onChangeText={setQuery} placeholder="Start typing your university" placeholderTextColor={colors.outline}
                  style={[styles.input, { color: colors.text }]} autoCapitalize="words" />
              </View>
              {matches && <View style={[styles.match, { backgroundColor: colors.surfaceContainerHigh }]}>
                <Ionicons name="checkmark-circle" size={20} color={colors.tint} />
                <AppText style={{ flex: 1, color: colors.text }}>{university.name} · Verified</AppText>
              </View>}
              {!!query.trim() && !matches && <AppText style={{ color: colors.outline }}>Your email is verified for {university.name}. Other universities cannot be selected.</AppText>}
              {matches && <>
                <AppText style={[styles.label, { color: colors.text }]}>Official calendar URL</AppText>
                <View style={[styles.inputWrap, { borderColor: colors.outlineVariant, backgroundColor: colors.cardBackground }]}>
                  <Ionicons name="link-outline" size={20} color={colors.outline} />
                  <TextInput value={calendarUrl} onChangeText={setCalendarUrl} placeholder="https://university.edu/calendar" placeholderTextColor={colors.outline}
                    autoCapitalize="none" autoCorrect={false} keyboardType="url" style={[styles.input, { color: colors.text }]} />
                </View>
                <AppText style={{ color: colors.outline, fontSize: 13 }}>Official RSS or iCalendar URLs are preferred. Calendar submissions will require review before importing events.</AppText>
                <Pressable onPress={() => void submitCalendar()} disabled={!validUrl || submitting || submitted}
                  accessibilityRole="button" accessibilityState={{ disabled: !validUrl || submitting || submitted }}
                  style={[styles.submitButton, { backgroundColor: colors.tint, opacity: !validUrl || submitting || submitted ? 0.45 : 1 }]}>
                  {submitting ? <ActivityIndicator color={colors.onPrimary} /> :
                    <AppText style={{ color: colors.onPrimary, fontWeight: '700', textAlign: 'center' }}>
                      {submitted ? 'Submitted for Review' : 'Submit for Review'}
                    </AppText>}
                </Pressable>
                {submitted && <AppText style={{ color: colors.tint }}>Submission received. Approval is required before events are imported.</AppText>}
              </>}

            </>}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 14 },
  heading: { fontSize: 19, fontWeight: '800' },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 36, gap: 14 },
  label: { fontSize: 14, fontWeight: '700', marginTop: 8 },
  inputWrap: { minHeight: 54, borderRadius: 13, borderWidth: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 9 },
  input: { flex: 1, paddingVertical: 12, fontSize: 15 },
  match: { padding: 14, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 9 },
  notice: { padding: 18, borderRadius: 14, gap: 9, marginTop: 8 },
  submitButton: { minHeight: 52, justifyContent: 'center', borderRadius: 14, marginTop: 12, padding: 12 },
});
