import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Switch, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { AppView } from '@/components/view';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { supabase } from '@/lib/supabase';

type SettingKey = 'chat_messages' | 'activity_updates' | 'ride_updates' | 'follow_requests';

const OPTIONS: { key: SettingKey; label: string; description: string }[] = [
  { key: 'chat_messages', label: 'Chat messages', description: 'New messages in your chats' },
  { key: 'activity_updates', label: 'Activity updates', description: 'Join requests and waitlist spots' },
  { key: 'ride_updates', label: 'Ride updates', description: 'Ride requests and driver arrivals' },
  { key: 'follow_requests', label: 'Follow requests', description: 'When someone wants to follow you' },
];

const DEFAULTS: Record<SettingKey, boolean> = {
  chat_messages: true,
  activity_updates: true,
  ride_updates: true,
  follow_requests: true,
};

export default function NotificationSettingsScreen() {
  const insets = useSafeAreaInsets();
  const theme = useColorScheme() ?? 'light';
  const colors = Colors[theme];

  const [userId, setUserId] = useState<string | null>(null);
  const [settings, setSettings] = useState(DEFAULTS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const { data } = await supabase
        .from('notification_settings')
        .select('chat_messages, activity_updates, ride_updates, follow_requests')
        .eq('user_id', user.id)
        .maybeSingle();
      if (data) setSettings(data);
      setLoading(false);
    })();
  }, []);

  async function toggle(key: SettingKey, value: boolean) {
    if (!userId) return;
    const previous = settings;
    const next = { ...settings, [key]: value };
    setSettings(next);
    const { error } = await supabase
      .from('notification_settings')
      .upsert({ user_id: userId, ...next, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
    if (error) setSettings(previous);
  }

  return (
    <AppView style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: colors.outlineVariant }]}>
        <TouchableOpacity onPress={() => router.back()} style={[styles.backButton, { backgroundColor: colors.surfaceContainerHigh }]}>
          <IconSymbol name="chevron.left" size={20} color={colors.text} />
        </TouchableOpacity>
        <AppText style={[styles.headerTitle, { color: colors.text, fontFamily: Fonts?.sans }]}>Notifications</AppText>
        <View style={styles.backButton} />
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 32 }} />
      ) : (
        <View style={styles.list}>
          {OPTIONS.map((option) => (
            <View key={option.key} style={[styles.row, { borderBottomColor: colors.outlineVariant }]}>
              <View style={{ flex: 1 }}>
                <AppText style={[styles.label, { color: colors.text, fontFamily: Fonts?.sans }]}>{option.label}</AppText>
                <AppText style={[styles.description, { color: colors.outline, fontFamily: Fonts?.sans }]}>{option.description}</AppText>
              </View>
              <Switch value={settings[option.key]} onValueChange={(value) => toggle(option.key, value)} />
            </View>
          ))}
          <AppText style={[styles.note, { color: colors.outline, fontFamily: Fonts?.sans }]}>
            Activity announcements are always delivered.
          </AppText>
        </View>
      )}
    </AppView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '600' },
  list: { paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, gap: 12 },
  label: { fontSize: 16, fontWeight: '600' },
  description: { fontSize: 13, marginTop: 2 },
  note: { fontSize: 12, marginTop: 16 },
});