import { Pressable, View } from 'react-native';
import { AppText } from '@/components/text';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export function ChatError({ message, onRetry }: { message: string; onRetry: () => void }) {
  const colors = Colors[useColorScheme() ?? 'light'];
  if (!message) return null;
  return <View style={{ padding: 12, gap: 8 }}>
    <AppText accessibilityRole="alert" style={{ color: colors.text }}>{message}</AppText>
    <Pressable accessibilityRole="button" onPress={onRetry}
      style={{ alignSelf: 'flex-start', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 18, backgroundColor: colors.tint }}>
      <AppText style={{ color: colors.onPrimary, fontWeight: '700' }}>Retry</AppText>
    </Pressable>
  </View>;
}
