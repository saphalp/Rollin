import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/text';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { BackButton } from '@/components/ui/back-button';

type OfferRideHeaderProps = {
  onBack: () => void;
  title?: string;
  subtitle?: string;
};

export function OfferRideHeader({
  onBack,
  title = 'Offer a Ride',
  subtitle = 'Share your available seats',
}: OfferRideHeaderProps) {
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
      <BackButton onPress={onBack} accessibilityLabel="Go back to rides" />

      <View style={styles.headerTitleContainer}>
        <AppText numberOfLines={1} style={[styles.headerTitle, { color: colors.text, fontFamily: Fonts?.sans }]}>
          {title}
        </AppText>

        <AppText numberOfLines={1} style={[styles.headerSubtitle, { color: colors.icon, fontFamily: Fonts?.sans }]}>
          {subtitle}
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
