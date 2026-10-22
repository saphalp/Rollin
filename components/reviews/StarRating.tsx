import { Pressable, StyleSheet, View } from 'react-native';

import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type StarRatingProps = {
  value: number;
  size?: number;
  // Omit to render a read-only row.
  onChange?: (value: number) => void;
  disabled?: boolean;
};

function starIcon(position: number, value: number): IconSymbolName {
  if (value >= position) return 'star.fill';
  if (value >= position - 0.5) return 'star.leadinghalf.filled';
  return 'star';
}

export function StarRating({ value, size = 16, onChange, disabled }: StarRatingProps) {
  const colors = Colors[useColorScheme() ?? 'light'];
  const color = colors.secondaryContainer;

  if (!onChange) {
    return (
      <View style={styles.row} accessible accessibilityLabel={`${value} out of 5 stars`}>
        {[1, 2, 3, 4, 5].map((n) => <IconSymbol key={n} name={starIcon(n, value)} size={size} color={color} />)}
      </View>
    );
  }

  return (
    <View style={[styles.row, styles.inputRow]} accessibilityRole="radiogroup">
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable
          key={n}
          disabled={disabled}
          onPress={() => onChange(n)}
          hitSlop={6}
          accessibilityRole="radio"
          accessibilityLabel={`${n} star${n === 1 ? '' : 's'}`}
          accessibilityState={{ selected: n === value, disabled }}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <IconSymbol name={n <= value ? 'star.fill' : 'star'} size={size} color={n <= value ? color : colors.outline} />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  inputRow: { gap: 10 },
  pressed: { opacity: 0.6, transform: [{ scale: 0.92 }] },
});
