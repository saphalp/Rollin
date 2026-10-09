import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { TutorialOutcome } from '@/lib/tutorial';
import { TUTORIAL_STEPS } from './tutorial-steps';

type Props = {
  onFinish: (outcome: TutorialOutcome) => Promise<void>;
  onContinueWithoutSaving?: () => void;
};

export function Tutorial({ onFinish, onContinueWithoutSaving }: Props) {
  const colors = Colors[useColorScheme() ?? 'light'];
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const pending = useRef(false);
  const scroll = useRef<ScrollView>(null);
  const current = TUTORIAL_STEPS[step];
  const last = step === TUTORIAL_STEPS.length - 1;

  function move(next: number) {
    setStep(next);
    scroll.current?.scrollTo({ y: 0, animated: false });
  }

  async function finish(outcome: TutorialOutcome) {
    if (pending.current) return;
    pending.current = true;
    setSaving(true);
    setError(false);
    try {
      await onFinish(outcome);
    } catch {
      setError(true);
    } finally {
      pending.current = false;
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={styles.top}>
        <Text style={[styles.brand, { color: colors.tint }]}>Rollin&apos; / Quick start</Text>
        <Button textColor={colors.tint} disabled={saving} onPress={() => void finish('skipped')}>Skip</Button>
      </View>
      <ScrollView ref={scroll} contentContainerStyle={styles.content}>
        <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.outlineVariant }]}>
          <View style={[styles.icon, { backgroundColor: colors.surfaceContainerHigh }]}>
            <IconSymbol name={current.icon} size={48} color={colors.tint} />
          </View>
          <Text style={[styles.label, { color: colors.tint }]}>{current.label}</Text>
          <Text accessibilityRole="header" accessibilityLiveRegion="polite" style={[styles.title, { color: colors.text }]}>{current.title}</Text>
          <Text style={[styles.description, { color: colors.icon }]}>{current.description}</Text>
          {current.tips.map((tip, index) => (
            <View key={tip} style={styles.tip}>
              <Text style={[styles.number, { color: colors.tint }]}>{index + 1}.</Text>
              <Text style={[styles.tipText, { color: colors.text }]}>{tip}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
      <View style={styles.footer}>
        <Text style={[styles.progress, { color: colors.icon }]}>Step {step + 1} of {TUTORIAL_STEPS.length}</Text>
        {error && (
          <View style={styles.error}>
            <Text accessibilityRole="alert" style={{ color: colors.error }}>
              We couldn&apos;t save your tutorial preference. Check your connection and try again.
            </Text>
            {onContinueWithoutSaving && (
              <Button disabled={saving} onPress={onContinueWithoutSaving} textColor={colors.tint}>Continue without saving</Button>
            )}
          </View>
        )}
        <View style={styles.actions}>
          <Button mode="outlined" disabled={step === 0 || saving} onPress={() => move(step - 1)} textColor={colors.tint} style={styles.back}>Back</Button>
          <Button mode="contained" loading={saving} disabled={saving} onPress={() => last ? void finish('completed') : move(step + 1)} buttonColor={colors.tint} textColor={colors.onPrimary} style={styles.next} contentStyle={styles.button}>
            {last ? 'Start exploring' : 'Next'}
          </Button>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 8 },
  brand: { fontSize: 16, fontWeight: '700', flexShrink: 1 },
  content: { flexGrow: 1, padding: 20, justifyContent: 'center', alignItems: 'center' },
  card: { width: '100%', maxWidth: 560, borderWidth: 1, borderRadius: 24, padding: 24, gap: 18 },
  icon: { width: 88, height: 88, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 14, fontWeight: '700' },
  title: { fontSize: 30, lineHeight: 38, fontWeight: '700' },
  description: { fontSize: 17, lineHeight: 26 },
  tip: { flexDirection: 'row', gap: 10 },
  number: { fontSize: 16, fontWeight: '700', lineHeight: 24 },
  tipText: { flex: 1, fontSize: 16, lineHeight: 24 },
  footer: { width: '100%', maxWidth: 600, alignSelf: 'center', padding: 20, gap: 12 },
  progress: { textAlign: 'center', fontSize: 14 },
  actions: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  back: { flex: 1 },
  next: { flex: 2 },
  button: { minHeight: 48 },
  error: { gap: 8 },
});
