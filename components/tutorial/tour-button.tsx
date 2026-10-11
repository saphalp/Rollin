import { Pressable, StyleSheet, Text, type PressableProps } from 'react-native';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type Props = Pick<PressableProps, 'onPress' | 'disabled'> & { children: string; primary?: boolean };

// No single-line limit or ellipsis: labels may wrap and the control grows with them.
export function TourButton({ children, primary = false, disabled, onPress }: Props) {
  const colors = Colors[useColorScheme() ?? 'light'];
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={children} accessibilityState={{ disabled: !!disabled }} disabled={disabled} onPress={onPress}
      style={({ pressed }) => [styles.button, { borderColor: colors.tint, backgroundColor: primary ? colors.tint : 'transparent', opacity: disabled ? 0.45 : pressed ? 0.75 : 1 }]}>
      <Text style={[styles.label, { color: primary ? colors.onPrimary : colors.tint }]}>{children}</Text>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  button: { minHeight: 48, paddingHorizontal: 12, paddingVertical: 12, borderWidth: 1, borderRadius: 24, justifyContent: 'center', alignItems: 'center', alignSelf: 'stretch' },
  label: { fontSize: 16, fontWeight: '600', textAlign: 'center', flexShrink: 1, alignSelf: 'stretch' },
});
