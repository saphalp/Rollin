import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, StyleSheet, Switch, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { AppView } from '@/components/view';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { supabase } from '@/lib/supabase';
import { BACK_BUTTON_SIZE, BackButton } from '@/components/ui/back-button';

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

const RADIUS_OPTIONS = [1, 5, 10] as const;
type RadiusMiles = typeof RADIUS_OPTIONS[number];

export default function NotificationSettingsScreen() {
  const insets = useSafeAreaInsets();
  const theme = useColorScheme() ?? 'light';
  const colors = Colors[theme];

  const [userId, setUserId] = useState<string | null>(null);
  const [settings, setSettings] = useState(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [nearbyEnabled, setNearbyEnabled] = useState(false);
  const [radiusMiles, setRadiusMiles] = useState<RadiusMiles>(5);
  const [radiusPickerVisible, setRadiusPickerVisible] = useState(false);
  const [savingNearby, setSavingNearby] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const { data } = await supabase
        .from('notification_settings')
        .select('chat_messages, activity_updates, ride_updates, follow_requests, nearby_activities_enabled, nearby_activities_radius_miles')
        .eq('user_id', user.id)
        .maybeSingle();
      if (data) {
        setSettings({
          chat_messages: data.chat_messages,
          activity_updates: data.activity_updates,
          ride_updates: data.ride_updates,
          follow_requests: data.follow_requests,
        });
        setNearbyEnabled(data.nearby_activities_enabled ?? false);
        setRadiusMiles((data.nearby_activities_radius_miles as RadiusMiles) ?? 5);
      }
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

  async function toggleNearby(value: boolean) {
    if (!userId) return;
    setSavingNearby(true);

    if (value) {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Location required', 'Allow location access in Settings to use nearby activity alerts.');
        setSavingNearby(false);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { error } = await supabase
        .from('notification_settings')
        .upsert({
          user_id: userId,
          nearby_activities_enabled: true,
          nearby_activities_radius_miles: radiusMiles,
          user_latitude: loc.coords.latitude,
          user_longitude: loc.coords.longitude,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });
      if (!error) setNearbyEnabled(true);
    } else {
      const { error } = await supabase
        .from('notification_settings')
        .upsert({
          user_id: userId,
          nearby_activities_enabled: false,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });
      if (!error) setNearbyEnabled(false);
    }
    setSavingNearby(false);
  }

  async function saveRadius(miles: RadiusMiles) {
    setRadiusMiles(miles);
    setRadiusPickerVisible(false);
    if (!userId) return;
    await supabase
      .from('notification_settings')
      .upsert({
        user_id: userId,
        nearby_activities_radius_miles: miles,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
  }

  return (
    <AppView style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: colors.outlineVariant }]}>
        <BackButton />
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

          {/* Location-based alerts section */}
          <AppText style={[styles.sectionHeading, { color: colors.text, fontFamily: Fonts?.sans }]}>
            Location
          </AppText>

          <View style={[styles.row, { borderBottomColor: colors.outlineVariant }]}>
            <View style={{ flex: 1 }}>
              <AppText style={[styles.label, { color: colors.text, fontFamily: Fonts?.sans }]}>Nearby activity alerts</AppText>
              <AppText style={[styles.description, { color: colors.outline, fontFamily: Fonts?.sans }]}>
                Only get notified about activities within your chosen distance
              </AppText>
            </View>
            {savingNearby
              ? <ActivityIndicator size="small" color={colors.tint} />
              : <Switch value={nearbyEnabled} onValueChange={toggleNearby} />
            }
          </View>

          {nearbyEnabled && (
            <View style={[styles.row, { borderBottomColor: colors.outlineVariant }]}>
              <View style={{ flex: 1 }}>
                <AppText style={[styles.label, { color: colors.text, fontFamily: Fonts?.sans }]}>Alert radius</AppText>
                <AppText style={[styles.description, { color: colors.outline, fontFamily: Fonts?.sans }]}>
                  Only notify me about activities within this distance
                </AppText>
              </View>
              <TouchableOpacity
                onPress={() => setRadiusPickerVisible(true)}
                style={[styles.radiusButton, { backgroundColor: colors.surfaceContainerHigh, borderColor: colors.outlineVariant }]}
              >
                <AppText style={[styles.radiusText, { color: colors.tint, fontFamily: Fonts?.sans }]}>
                  {radiusMiles} mi
                </AppText>
                <IconSymbol name="chevron.down" size={14} color={colors.tint} />
              </TouchableOpacity>
            </View>
          )}

          <AppText style={[styles.note, { color: colors.outline, fontFamily: Fonts?.sans }]}>
            Activity announcements are always delivered.
          </AppText>
        </View>
      )}

      {/* Radius picker modal */}
      <Modal
        visible={radiusPickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRadiusPickerVisible(false)}
      >
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setRadiusPickerVisible(false)}>
          <View style={[styles.modalSheet, { backgroundColor: colors.cardBackground, borderColor: colors.outlineVariant }]}>
            <AppText style={[styles.modalTitle, { color: colors.text, fontFamily: Fonts?.sans }]}>Alert radius</AppText>
            {RADIUS_OPTIONS.map((miles) => (
              <TouchableOpacity
                key={miles}
                style={[styles.modalRow, { borderBottomColor: colors.outlineVariant }]}
                onPress={() => saveRadius(miles)}
              >
                <AppText style={[styles.modalRowText, { color: miles === radiusMiles ? colors.tint : colors.text, fontFamily: Fonts?.sans }]}>
                  {miles} mile{miles !== 1 ? 's' : ''}
                </AppText>
                {miles === radiusMiles && (
                  <IconSymbol name="checkmark" size={16} color={colors.tint} />
                )}
              </TouchableOpacity>
            ))}
            <TouchableOpacity onPress={() => setRadiusPickerVisible(false)} style={styles.modalCancel}>
              <AppText style={[styles.modalCancelText, { color: colors.outline, fontFamily: Fonts?.sans }]}>Cancel</AppText>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
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
  backButton: { width: BACK_BUTTON_SIZE, height: BACK_BUTTON_SIZE },
  headerTitle: { fontSize: 17, fontWeight: '600' },
  list: { paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, gap: 12 },
  label: { fontSize: 16, fontWeight: '600' },
  description: { fontSize: 13, marginTop: 2 },
  sectionHeading: { fontSize: 13, fontWeight: '700', marginTop: 24, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  note: { fontSize: 12, marginTop: 16 },
  radiusButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  radiusText: { fontSize: 14, fontWeight: '600' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 32 },
  modalSheet: { width: '100%', borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  modalTitle: { fontSize: 16, fontWeight: '700', padding: 16, paddingBottom: 8 },
  modalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  modalRowText: { fontSize: 16 },
  modalCancel: { padding: 16, alignItems: 'center' },
  modalCancelText: { fontSize: 15 },
});
