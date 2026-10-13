import { router, Stack } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/components/text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

// UI only. Enable an option only after its screen and backend are connected.
const options = [
  { title: 'Privacy Settings', description: 'Control who can see your profile and linked social accounts.' },
  { title: 'Linked Social Accounts', description: 'Add, edit, or remove Instagram, LinkedIn, and Facebook links.' },
  { title: 'Share Profile', description: 'Copy or share a profile link that respects your privacy settings.' },
  { title: 'Deactivate Account', description: 'Temporarily deactivate your account.' },
  { title: 'Delete Account', description: 'Permanently delete your account.', destructive: true },
];

export default function AccountCenterScreen() {
  const colors = Colors[useColorScheme() ?? 'light'];
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.header, { paddingTop: insets.top + 12, borderColor: colors.outlineVariant }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Go back" hitSlop={12} onPress={() => router.back()}>
          <IconSymbol name="chevron.left" size={24} color={colors.text} />
        </Pressable>
        <AppText style={[styles.title, { color: colors.text, fontFamily: Fonts?.sans }]}>Account Center</AppText>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
        <AppText style={[styles.intro, { color: colors.text }]}>Manage your privacy, profile sharing, and account.</AppText>
        {options.map(option => (
          <View key={option.title} accessibilityState={{ disabled: true }} style={[styles.row, { borderColor: colors.outlineVariant }]}>
            <AppText style={[styles.label, { color: option.destructive ? colors.error : colors.text }]}>{option.title}</AppText>
            <AppText style={[styles.description, { color: colors.text }]}>{option.description}</AppText>
            <AppText style={[styles.availability, { color: colors.outline }]}>Not available yet</AppText>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { fontSize: 22, fontWeight: '700' },
  content: { padding: 20, gap: 16 },
  intro: { fontSize: 14, lineHeight: 21, marginBottom: 4 },
  row: { padding: 18, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, gap: 8 },
  label: { fontSize: 16, fontWeight: '600' },
  description: { fontSize: 13, lineHeight: 20, opacity: 0.8 },
  availability: { fontSize: 12 },
});
