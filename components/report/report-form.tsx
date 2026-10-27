import { router } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Button, TextInput } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { AppView } from '@/components/view';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { submitReport } from '@/services/reports';
import {
  REPORT_DETAILS_MAX_LENGTH,
  REPORT_REASONS,
  REPORT_TARGET_LABELS,
  type ReportReason,
  type ReportTargetType,
} from '@/types/reports';

type Step = 'form' | 'confirm' | 'done';

// Raised by submit_report; anything else gets the generic message.
const KNOWN_SUBMIT_ERRORS = [
  'That content no longer exists',
  'You cannot report your own content',
  'Sign in to submit a report',
];

type Props = {
  targetType: ReportTargetType;
  targetId: string;
  targetName?: string;
};

export function ReportForm({ targetType, targetId, targetName }: Props) {
  const insets = useSafeAreaInsets();
  const theme = useColorScheme() ?? 'light';
  const colors = Colors[theme];

  const [step, setStep] = useState<Step>('form');
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const label = REPORT_TARGET_LABELS[targetType];
  const reasons = REPORT_REASONS[targetType];
  const reasonLabel = reasons.find((r) => r.value === reason)?.label;
  const subject = targetName ? `${label.toLowerCase()} "${targetName}"` : `this ${label.toLowerCase()}`;

  function handleBack() {
    if (step === 'confirm') setStep('form');
    else router.back();
  }

  async function handleSubmit() {
    if (!reason || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      await submitReport({ targetType, targetId, reason, details });
      setStep('done');
    } catch (e) {
      console.error('[report] submit failed:', e);
      const message = (e as { message?: string } | null)?.message ?? '';
      setError(
        KNOWN_SUBMIT_ERRORS.find((known) => message.includes(known))
          ?? 'Could not submit your report. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppView style={styles.container}>
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 8,
            borderBottomColor: colors.outlineVariant,
            backgroundColor: colors.background,
          },
        ]}
      >
        {step === 'done' ? (
          <View style={styles.backButton} />
        ) : (
          <TouchableOpacity
            onPress={handleBack}
            style={[styles.backButton, { backgroundColor: colors.surfaceContainerHigh }]}
            accessibilityLabel="Back"
          >
            <IconSymbol name="chevron.left" size={20} color={colors.text} />
          </TouchableOpacity>
        )}

        <AppText style={[styles.headerTitle, { color: colors.text, fontFamily: Fonts?.sans }]}>
          Report {label}
        </AppText>

        <View style={styles.backButton} />
      </View>

      {step === 'done' ? (
        <View style={[styles.doneBody, { paddingBottom: insets.bottom + 24 }]}>
          <View style={[styles.doneIcon, { backgroundColor: colors.surfaceContainerHigh }]}>
            <IconSymbol name="checkmark.circle.fill" size={44} color={colors.verified} />
          </View>
          <AppText style={[styles.doneTitle, { color: colors.text, fontFamily: Fonts?.sans }]}>
            Thanks for letting us know
          </AppText>
          <AppText style={[styles.doneMessage, { color: colors.icon, fontFamily: Fonts?.sans }]}>
            The report has been submitted and will be reviewed.
          </AppText>
          <Button
            mode="contained"
            onPress={() => router.back()}
            buttonColor={colors.tint}
            textColor={colors.onPrimary}
            style={styles.primaryButton}
            contentStyle={styles.buttonContent}
            labelStyle={{ fontFamily: Fonts?.sans }}
          >
            Done
          </Button>
        </View>
      ) : (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 24 }]}
            keyboardShouldPersistTaps="handled"
          >
            {step === 'form' ? (
              <>
                <AppText style={[styles.sectionTitle, { color: colors.text, fontFamily: Fonts?.sans }]}>
                  Why are you reporting {subject}?
                </AppText>
                <AppText style={[styles.hint, { color: colors.outline, fontFamily: Fonts?.sans }]}>
                  Your report is anonymous. The {label.toLowerCase()} won&apos;t know who reported it.
                </AppText>

                <View
                  style={[
                    styles.card,
                    { backgroundColor: colors.cardBackground, borderColor: colors.outlineVariant },
                  ]}
                  accessibilityRole="radiogroup"
                >
                  {reasons.map((option, index) => {
                    const selected = option.value === reason;
                    return (
                      <Pressable
                        key={option.value}
                        onPress={() => setReason(option.value)}
                        accessibilityRole="radio"
                        accessibilityState={{ selected }}
                        style={({ pressed }) => [
                          styles.reasonRow,
                          index > 0 && {
                            borderTopWidth: StyleSheet.hairlineWidth,
                            borderTopColor: colors.outlineVariant,
                          },
                          pressed && { backgroundColor: colors.surfaceContainer },
                        ]}
                      >
                        <AppText
                          style={[styles.reasonText, { color: colors.text, fontFamily: Fonts?.sans }]}
                        >
                          {option.label}
                        </AppText>
                        <IconSymbol
                          name={selected ? 'record.circle' : 'circle'}
                          size={22}
                          color={selected ? colors.tint : colors.outline}
                        />
                      </Pressable>
                    );
                  })}
                </View>

                <AppText style={[styles.sectionTitle, { color: colors.text, fontFamily: Fonts?.sans }]}>
                  Anything else we should know?
                </AppText>
                <TextInput
                  mode="outlined"
                  value={details}
                  onChangeText={setDetails}
                  placeholder="Optional: add details that help us review this report"
                  multiline
                  maxLength={REPORT_DETAILS_MAX_LENGTH}
                  textColor={colors.text}
                  placeholderTextColor={colors.outline}
                  outlineColor={colors.outlineVariant}
                  activeOutlineColor={colors.tint}
                  style={{ backgroundColor: colors.cardBackground }}
                  contentStyle={[styles.detailsInput, { fontFamily: Fonts?.sans }]}
                />
                <AppText style={[styles.counter, { color: colors.outline }]}>
                  {details.length}/{REPORT_DETAILS_MAX_LENGTH}
                </AppText>

                <Button
                  mode="contained"
                  onPress={() => setStep('confirm')}
                  disabled={!reason}
                  buttonColor={colors.tint}
                  textColor={colors.onPrimary}
                  style={[styles.primaryButton, !reason && styles.disabled]}
                  contentStyle={styles.buttonContent}
                  labelStyle={{ fontFamily: Fonts?.sans }}
                >
                  Continue
                </Button>
              </>
            ) : (
              <>
                <AppText style={[styles.sectionTitle, { color: colors.text, fontFamily: Fonts?.sans }]}>
                  Submit this report?
                </AppText>
                <AppText style={[styles.hint, { color: colors.outline, fontFamily: Fonts?.sans }]}>
                  Our team will review {subject} and take action if it breaks community guidelines.
                </AppText>

                <View
                  style={[
                    styles.card,
                    styles.summary,
                    { backgroundColor: colors.cardBackground, borderColor: colors.outlineVariant },
                  ]}
                >
                  <SummaryRow label="Reporting" value={targetName || label} />
                  <SummaryRow label="Reason" value={reasonLabel ?? ''} />
                  <SummaryRow label="Details" value={details.trim() || 'None provided'} />
                </View>

                {error ? (
                  <AppText style={[styles.error, { color: colors.error, fontFamily: Fonts?.sans }]}>
                    {error}
                  </AppText>
                ) : null}

                <Button
                  mode="contained"
                  onPress={handleSubmit}
                  loading={submitting}
                  disabled={submitting}
                  buttonColor={colors.error}
                  textColor={colors.onError}
                  style={styles.primaryButton}
                  contentStyle={styles.buttonContent}
                  labelStyle={{ fontFamily: Fonts?.sans }}
                >
                  Submit Report
                </Button>
                <Button
                  mode="text"
                  onPress={() => setStep('form')}
                  disabled={submitting}
                  textColor={colors.tint}
                  style={styles.secondaryButton}
                  labelStyle={{ fontFamily: Fonts?.sans }}
                >
                  Edit Report
                </Button>
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </AppView>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  const theme = useColorScheme() ?? 'light';
  const colors = Colors[theme];
  return (
    <View style={styles.summaryRow}>
      <AppText style={[styles.summaryLabel, { color: colors.outline, fontFamily: Fonts?.sans }]}>
        {label}
      </AppText>
      <AppText style={[styles.summaryValue, { color: colors.text, fontFamily: Fonts?.sans }]}>
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, lineHeight: 24, fontWeight: '600' },
  body: { padding: 16, gap: 12 },
  sectionTitle: { fontSize: 17, lineHeight: 24, fontWeight: '700', marginTop: 4 },
  hint: { fontSize: 13, lineHeight: 18, marginTop: -6 },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
  },
  reasonText: { flex: 1, fontSize: 15, lineHeight: 20 },
  // Paper's outlined multiline input pads the top and sides differently; even them out so the
  // placeholder sits the same distance from the top, left, and right edges.
  detailsInput: {
    minHeight: 120,
    paddingTop: 14,
    paddingBottom: 14,
    paddingHorizontal: 14,
    textAlignVertical: 'top',
  },
  counter: { alignSelf: 'flex-end', marginTop: -6, fontSize: 12, lineHeight: 16 },
  primaryButton: { marginTop: 8, borderRadius: 12 },
  secondaryButton: { borderRadius: 12 },
  buttonContent: { height: 48 },
  disabled: { opacity: 0.5 },
  summary: { padding: 14, gap: 12 },
  summaryRow: { gap: 2 },
  summaryLabel: { fontSize: 12, lineHeight: 16, fontWeight: '600', textTransform: 'uppercase' },
  summaryValue: { fontSize: 15, lineHeight: 20 },
  error: { fontSize: 13, lineHeight: 18 },
  doneBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  doneIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  doneTitle: { fontSize: 20, lineHeight: 26, fontWeight: '700', textAlign: 'center' },
  doneMessage: { fontSize: 15, lineHeight: 21, textAlign: 'center' },
});
