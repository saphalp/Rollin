import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export const BACK_BUTTON_SIZE = 40;

type Props = {
  /** Defaults to going back, or to `fallbackHref` when there's no screen to go back to. */
  onPress?: () => void;
  fallbackHref?: Href;
  disabled?: boolean;
  /** `floating` adds a round card background for buttons drawn over photos or maps. */
  variant?: 'plain' | 'floating';
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

/** The app's one back button: a blue chevron with no label. */
export function BackButton({
  onPress,
  fallbackHref = '/(tabs)',
  disabled = false,
  variant = 'plain',
  accessibilityLabel = 'Back',
  style,
}: Props) {
  const theme = useColorScheme() ?? 'light';
  const colors = Colors[theme];

  function handlePress() {
    if (onPress) {
      onPress();
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(fallbackHref);
    }
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={handlePress}
      disabled={disabled}
      hitSlop={8}
      style={({ pressed }) => [
        styles.button,
        variant === 'floating' && [styles.floating, { backgroundColor: colors.cardBackground }],
        { opacity: disabled ? 0.4 : pressed ? 0.6 : 1 },
        style,
      ]}
    >
      <Ionicons name="chevron-back" size={26} color={colors.tint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: BACK_BUTTON_SIZE,
    height: BACK_BUTTON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  floating: {
    borderRadius: BACK_BUTTON_SIZE / 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
});
