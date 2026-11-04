import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/text';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

/** Shows which activity a ride or request belongs to, or that it's an independent ride. */
export function RideActivityBadge({ activityTitle }: { activityTitle: string | null | undefined }) {
  const theme = useColorScheme() ?? 'light';
  const colors = Colors[theme];
  const isActivity = Boolean(activityTitle);

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: isActivity ? colors.secondaryContainer : colors.surfaceContainer },
      ]}
    >
      <MaterialCommunityIcons
        name={isActivity ? 'calendar-star' : 'map-marker-path'}
        size={13}
        color={isActivity ? colors.onSecondaryContainer : colors.icon}
      />
      <AppText
        numberOfLines={1}
        style={[
          styles.text,
          { color: isActivity ? colors.onSecondaryContainer : colors.icon, fontFamily: Fonts?.sans },
        ]}
      >
        {activityTitle || 'Independent ride'}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    maxWidth: '100%',
    gap: 5,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  text: {
    flexShrink: 1,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
});
