import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { FollowRequestActor, FollowRequestRow } from '@/components/follow-request-row';
import { NotificationRow } from '@/components/notification-row';
import { AppText } from '@/components/text';
import { AppView } from '@/components/view';
import { Colors, Fonts } from '@/constants/theme';
import { useAuthContext } from '@/hooks/use-auth-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useNotificationRealtime } from '@/hooks/use-notification-realtime';
import { supabase } from '@/lib/supabase';

type Notification = {
  id: string;
  type: string | null;
  message: string;
  timestamp: string;
  isRead: boolean;
  actor: FollowRequestActor | null;
  isAccepted: boolean;
};

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
  const { claims } = useAuthContext();
  const currentUserId = claims?.sub as string | undefined;

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchNotifications().finally(() => setRefreshing(false));
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, []);

  // Live-prepend when a new notification lands for this user
  useNotificationRealtime(async (incoming) => {
    // Ignore if we already have this row (dedupe against local optimism)
    if (notifications.some((n) => n.id === incoming.id)) return;

    // Re-fetch just this row with the actor join so the row can render fully
    const { data } = await supabase
      .from('notifications')
      .select(
        'id, type, message, is_read, created_at, actor_id, actor:profiles!actor_id(id, full_name, profile_picture)'
      )
      .eq('id', incoming.id)
      .maybeSingle();

    if (!data) return;

    setNotifications((prev) => {
      if (prev.some((n) => n.id === data.id)) return prev;
      return [
        {
          id: data.id,
          type: data.type,
          message: data.message,
          timestamp: formatTimestamp(data.created_at),
          isRead: data.is_read,
          actor: data.actor as any,
          isAccepted: false,
        },
        ...prev,
      ];
    });
  });

  async function fetchNotifications() {
    const { data, error } = await supabase
      .from('notifications')
      .select(
        'id, type, message, is_read, created_at, actor_id, actor:profiles!actor_id(id, full_name, profile_picture)'
      )
      .order('created_at', { ascending: false });

    if (!error && data) {
      setNotifications(
        data.map((n: any) => ({
          id: n.id,
          type: n.type,
          message: n.message,
          timestamp: formatTimestamp(n.created_at),
          isRead: n.is_read,
          actor: n.actor,
          isAccepted: false,
        }))
      );
    }
    setLoading(false);
  }

  async function markAsRead(id: string) {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
  }

  async function handleAccept(n: Notification) {
    if (!n.actor || !currentUserId) return;

    setNotifications((prev) =>
      prev.map((x) =>
        x.id === n.id ? { ...x, isAccepted: true, isRead: true } : x
      )
    );

    const { error: followErr } = await supabase
      .from('follows')
      .update({ status: 'accepted' })
      .eq('follower_id', n.actor.id)
      .eq('following_id', currentUserId);

    if (followErr) {
      setNotifications((prev) =>
        prev.map((x) =>
          x.id === n.id ? { ...x, isAccepted: false } : x
        )
      );
      return;
    }

    await supabase.from('notifications').update({ is_read: true }).eq('id', n.id);
  }

  async function handleReject(n: Notification) {
    if (!n.actor || !currentUserId) return;

    const previous = notifications;
    setNotifications((prev) => prev.filter((x) => x.id !== n.id));

    const { error: followErr } = await supabase
      .from('follows')
      .delete()
      .eq('follower_id', n.actor.id)
      .eq('following_id', currentUserId);

    if (followErr) {
      setNotifications(previous);
      return;
    }

    await supabase.from('notifications').delete().eq('id', n.id);
  }

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
          renderItem={({ item }) => {
            if (item.type === 'follow_request' && item.actor) {
              return (
                <FollowRequestRow
                  actor={item.actor}
                  timestamp={item.timestamp}
                  isRead={item.isRead}
                  isAccepted={item.isAccepted}
                  onAccept={() => handleAccept(item)}
                  onReject={() => handleReject(item)}
                />
              );
            }
            return (
              <NotificationRow
                id={item.id}
                message={item.message}
                timestamp={item.timestamp}
                isRead={item.isRead}
                onPress={markAsRead}
              />
            );
          }}
          contentContainerStyle={{ paddingBottom: 16 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
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
