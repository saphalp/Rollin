import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';

import { NotificationItem, NotificationRow } from '@/components/notification-row';
import { AppText } from '@/components/text';
import { AppView } from '@/components/view';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { supabase } from '@/lib/supabase';

function formatTimestamp(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  return `${days}d ago`;
}

export default function NotificationsScreen() {
  const theme = useColorScheme() ?? 'light';
  const colors = Colors[theme];
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotifications();
  }, []);

  async function fetchNotifications() {
    const { data, error } = await supabase
      .from('notifications')
      .select('id, message, is_read, created_at')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setNotifications(
        data.map((n) => ({
          id: n.id,
          message: n.message,
          timestamp: formatTimestamp(n.created_at),
          isRead: n.is_read,
        }))
      );
    }
    setLoading(false);
  }

  async function markAsRead(id: string) {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id);
  }

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <AppView style={styles.container}>
      {loading ? (
        <ActivityIndicator style={styles.loader} color={colors.tint} />
      ) : notifications.length === 0 ? (
        <View style={styles.empty}>
          <AppText style={[styles.emptyText, { color: colors.outline, fontFamily: Fonts?.sans }]}>
            No notifications yet
          </AppText>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <NotificationRow {...item} onPress={markAsRead} />
          )}
          contentContainerStyle={{ paddingBottom: 16 }}
        />
      )}
    </AppView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loader: { flex: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 15 },
});
