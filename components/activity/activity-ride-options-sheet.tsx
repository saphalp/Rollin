import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RideActionCards } from '@/components/rides/ride-action-cards';
import { AppText } from '@/components/text';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type ActivityRideOptionsSheetProps = {
  visible: boolean;
  onClose: () => void;
  onFindRide: () => void;
  onOfferRide: () => void;
};

export function ActivityRideOptionsSheet({
  visible,
  onClose,
  onFindRide,
  onOfferRide,
}: ActivityRideOptionsSheetProps) {
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

          <View style={styles.header}>
            <AppText style={[styles.title, { color: colors.text, fontFamily: Fonts?.sans }]}>
              Ride sharing
            </AppText>
            <AppText style={[styles.subtitle, { color: colors.icon, fontFamily: Fonts?.sans }]}>
              Find a ride to this activity, or offer your own seats.
            </AppText>
          </View>

          <RideActionCards onFindRide={onFindRide} onOfferRide={onOfferRide} />
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
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12,
  },
  header: {
    gap: 4,
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
});
