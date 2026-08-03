import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/text';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type OfferRideHeaderProps = {
  onBack: () => void;
};

export function OfferRideHeader({ onBack }: OfferRideHeaderProps) {
  const theme = useColorScheme() ?? 'light';
  const colors = Colors[theme];
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.header,
        {
          paddingTop: insets.top + 10,
          borderBottomColor: colors.outlineVariant,
          backgroundColor: colors.cardBackground,
        },
      ]}
    >
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Go back to rides"
        onPress={onBack}
        style={[styles.backButton, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant }]}
      >
        <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
      </TouchableOpacity>

      <View style={styles.headerTitleContainer}>
        <AppText numberOfLines={1} style={[styles.headerTitle, { color: colors.text, fontFamily: Fonts?.sans }]}>
          Offer a Ride
        </AppText>

        <AppText numberOfLines={1} style={[styles.headerSubtitle, { color: colors.icon, fontFamily: Fonts?.sans }]}>
          Share your available seats
        </AppText>
      </View>

      <View style={styles.headerSpacer} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 12,
  },
  backButton: {
    width: 44,
    height: 44,
    borderWidth: 1,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  headerSubtitle: {
    marginTop: 1,
    fontSize: 12,
  },
  headerSpacer: {
    width: 44,
  },
});
