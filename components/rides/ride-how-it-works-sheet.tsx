import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/text';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

const STEPS: { icon: IconName; title: string; body: string }[] = [
  {
    icon: 'car-multiple',
    title: 'Offer a ride',
    body: 'Already driving somewhere? Post the trip and how many seats you have free.',
  },
  {
    icon: 'car-search-outline',
    title: 'Find or request a ride',
    body: 'Browse rides other students posted. Nothing fits? Post a request so drivers can find you.',
  },
  {
    icon: 'account-check-outline',
    title: 'Driver approves',
    body: 'Passengers ask for a seat, and the driver accepts or declines each request.',
  },
  {
    icon: 'map-marker-path',
    title: 'Ride together',
    body: 'When the trip starts, accepted passengers can follow the driver with live location.',
  },
];

type RideHowItWorksSheetProps = {
  visible: boolean;
  onClose: () => void;
};

export function RideHowItWorksSheet({ visible, onClose }: RideHowItWorksSheetProps) {
  const theme = useColorScheme() ?? 'light';
  const colors = Colors[theme];
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.container}>
        <Pressable style={styles.backdrop} onPress={onClose} />

        <View
          style={[
            styles.sheet,
            { backgroundColor: colors.surface, paddingBottom: insets.bottom + 16 },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: colors.outlineVariant }]} />

          <AppText style={[styles.title, { color: colors.text, fontFamily: Fonts?.sans }]}>
            How ride sharing works
          </AppText>

          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
            {STEPS.map((step, index) => (
              <View key={step.title} style={styles.step}>
                <View style={styles.rail}>
                  <View style={[styles.stepIcon, { backgroundColor: colors.surfaceContainer }]}>
                    <MaterialCommunityIcons name={step.icon} size={22} color={colors.tint} />
                  </View>
                  {index < STEPS.length - 1 && (
                    <View style={[styles.connector, { backgroundColor: colors.outlineVariant }]} />
                  )}
                </View>

                <View style={styles.stepText}>
                  <AppText style={[styles.stepTitle, { color: colors.text, fontFamily: Fonts?.sans }]}>
                    {step.title}
                  </AppText>
                  <AppText style={[styles.stepBody, { color: colors.icon, fontFamily: Fonts?.sans }]}>
                    {step.body}
                  </AppText>
                </View>
              </View>
            ))}
          </ScrollView>

          <TouchableOpacity
            accessibilityRole="button"
            onPress={onClose}
            style={[styles.doneButton, { backgroundColor: colors.tint }]}
          >
            <AppText style={[styles.doneText, { color: colors.onPrimary, fontFamily: Fonts?.sans }]}>
              Got it
            </AppText>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 8,
    maxHeight: '85%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: 18,
  },
  scrollView: {
    flexGrow: 0,
  },
  step: {
    flexDirection: 'row',
    gap: 14,
  },
  rail: {
    alignItems: 'center',
  },
  stepIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  connector: {
    width: 2,
    flex: 1,
    minHeight: 14,
    marginVertical: 4,
    borderRadius: 1,
  },
  stepText: {
    flex: 1,
    paddingTop: 2,
    paddingBottom: 18,
  },
  stepTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
  },
  stepBody: {
    marginTop: 3,
    fontSize: 13,
    lineHeight: 19,
  },
  doneButton: {
    marginTop: 4,
    borderRadius: 24,
    paddingVertical: 14,
    alignItems: 'center',
  },
  doneText: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
  },
});
