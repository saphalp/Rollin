import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

import { AppText } from '@/components/text';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export type RideTab = 'discover' | 'offering' | 'requests' | 'history';

type RideTabIcon =
  | 'map-search-outline'
  | 'car-outline'
  | 'account-arrow-right-outline'
  | 'history';

export const RIDE_TABS: { key: RideTab; label: string; icon: RideTabIcon }[] = [
  { key: 'discover', label: 'Discover', icon: 'map-search-outline' },
  { key: 'offering', label: 'Offering', icon: 'car-outline' },
  { key: 'requests', label: 'Requests', icon: 'account-arrow-right-outline' },
  { key: 'history', label: 'History', icon: 'history' },
];

type RideTabBarProps = {
  activeTab: RideTab;
  onTabChange: (tab: RideTab) => void;
};

export function RideTabBar({ activeTab, onTabChange }: RideTabBarProps) {
  const theme = useColorScheme() ?? 'light';
  const colors = Colors[theme];

  return (
    <View
      style={[
        styles.tabBar,
        { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant },
      ]}
    >
      {RIDE_TABS.map((tab) => {
        const selected = activeTab === tab.key;

        return (
          <TouchableOpacity
            key={tab.key}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onTabChange(tab.key)}
            style={[styles.tabButton, selected && { backgroundColor: colors.cardBackground }]}
          >
            <MaterialCommunityIcons
              name={tab.icon}
              size={19}
              color={selected ? colors.tint : colors.tabIconDefault}
            />

            <AppText
              numberOfLines={1}
              style={[
                styles.tabLabel,
                {
                  color: selected ? colors.tint : colors.tabIconDefault,
                  fontFamily: Fonts?.sans,
                },
              ]}
            >
              {tab.label}
            </AppText>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 16,
    padding: 4,
  },
  tabButton: {
    flex: 1,
    minHeight: 54,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingHorizontal: 2,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
});
