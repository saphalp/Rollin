import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/text';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type OfferRideIntroCardProps = {
  linkedActivityTitle?: string;
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  defaultTitle?: string;
  defaultSubtitle?: string;
  linkedSubtitle?: string;
};

export function OfferRideIntroCard({
  linkedActivityTitle,
  icon = 'car-multiple',
  defaultTitle = 'Create a ride offer',
  defaultSubtitle = 'Create a general trip or connect the ride to a public activity.',
  linkedSubtitle = 'This ride will be connected to the selected activity.',
}: OfferRideIntroCardProps) {
  const theme = useColorScheme() ?? 'light';
  const colors = Colors[theme];

  return (
    <View style={[styles.introCard, { backgroundColor: colors.cardBackground, borderColor: colors.outlineVariant }]}>
      <View style={[styles.iconContainer, { backgroundColor: colors.primaryContainer }]}>
        <MaterialCommunityIcons name={icon} size={30} color={colors.onPrimary} />
      </View>

      <AppText style={[styles.title, { color: colors.text, fontFamily: Fonts?.sans }]}>
        {linkedActivityTitle ?? defaultTitle}
      </AppText>

      <AppText style={[styles.subtitle, { color: colors.icon, fontFamily: Fonts?.sans }]}>
        {linkedActivityTitle ? linkedSubtitle : defaultSubtitle}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  introCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 20,
  },
  iconContainer: {
    width: 58,
    height: 58,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    marginTop: 18,
    fontSize: 22,
    fontWeight: '700',
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 21,
  },
});
