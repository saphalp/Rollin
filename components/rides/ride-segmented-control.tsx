import { StyleSheet, TouchableOpacity, View } from 'react-native';

import { AppText } from '@/components/text';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type Option<T extends string> = { key: T; label: string; count?: number };

type RideSegmentedControlProps<T extends string> = {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
};

/** Sub-section switch inside a Rides tab, e.g. "Offered by you" / "Offered by others". */
export function RideSegmentedControl<T extends string>({ options, value, onChange }: RideSegmentedControlProps<T>) {
  const theme = useColorScheme() ?? 'light';
  const colors = Colors[theme];

  return (
    <View style={[styles.bar, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant }]}>
      {options.map((option) => {
        const selected = option.key === value;

        return (
          <TouchableOpacity
            key={option.key}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.key)}
            style={[styles.button, selected && { backgroundColor: colors.cardBackground }]}
          >
            <AppText
              numberOfLines={1}
              style={[styles.label, { color: selected ? colors.tint : colors.icon, fontFamily: Fonts?.sans }]}
            >
              {option.label}
            </AppText>
            {option.count !== undefined && option.count > 0 && (
              <View style={[styles.count, { backgroundColor: selected ? colors.tint : colors.outlineVariant }]}>
                <AppText
                  style={[styles.countText, { color: selected ? colors.onPrimary : colors.text, fontFamily: Fonts?.sans }]}
                >
                  {option.count}
                </AppText>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 14,
    padding: 4,
  },
  button: {
    flex: 1,
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 10,
    paddingHorizontal: 6,
  },
  label: {
    flexShrink: 1,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '700',
  },
  count: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
  },
});
