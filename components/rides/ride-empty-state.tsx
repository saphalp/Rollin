import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/text';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type RideEmptyStateProps = {
  icon: 'car-outline' | 'account-arrow-right-outline' | 'history' | 'alert-circle-outline';
  title: string;
  message: string;
};

export function RideEmptyState({ icon, title, message }: RideEmptyStateProps) {
  const theme = useColorScheme() ?? 'light';
  const colors = Colors[theme];

  return (
    <View style={[styles.emptyState, { backgroundColor: colors.cardBackground, borderColor: colors.outlineVariant }]}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.surfaceContainer }]}>
        <MaterialCommunityIcons name={icon} size={32} color={colors.tint} />
      </View>

      <AppText style={[styles.emptyTitle, { color: colors.text, fontFamily: Fonts?.sans }]}>{title}</AppText>

      <AppText style={[styles.emptyMessage, { color: colors.icon, fontFamily: Fonts?.sans }]}>{message}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  emptyState: {
    minHeight: 320,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    marginTop: 18,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyMessage: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
});
