import { router } from 'expo-router';
import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import StepProgressBar from '@/components/profile/StepProgressBar';
import { AppText } from '@/components/text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type Props = {
  step: 1 | 2;
  /** Blocks leaving the page while a save or verification is in flight. */
  busy?: boolean;
  children: ReactNode;
};

/** Full-screen frame shared by both Edit Profile pages: header, step progress, scrolling body. */
export default function EditProfileShell({ step, busy = false, children }: Props) {
  const theme = useColorScheme() ?? 'light';
  const colors = Colors[theme];

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[styles.safeArea, { backgroundColor: colors.background }]}
    >
      <View style={styles.header}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => router.back()}
          disabled={busy}
          hitSlop={10}
          style={styles.headerSide}
        >
          <IconSymbol name="chevron.left" size={24} color={colors.text} />
        </TouchableOpacity>
        <AppText style={[styles.headerTitle, { color: colors.text, fontFamily: Fonts?.sans }]}>
          Edit Profile
        </AppText>
        <View style={styles.headerSide} />
      </View>

      <View style={styles.progressWrapper}>
        <StepProgressBar
          currentStep={step}
          totalSteps={2}
          stepLabels={['Personal Details', 'Driver & Vehicle']}
        />
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },

  headerSide: {
    width: 24,
  },

  headerTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700',
  },

  progressWrapper: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },

  keyboardView: {
    flex: 1,
  },

  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 40,
    gap: 24,
  },
});
