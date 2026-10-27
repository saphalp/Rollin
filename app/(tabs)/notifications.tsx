import { TourTarget } from '@/components/tutorial/tour-target';
import { useFocusEffect, useIsFocused } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { ActivityJoinRequestRow } from '@/components/activity-join-request-row';
import { FollowRequestActor, FollowRequestRow } from '@/components/follow-request-row';
import { NotificationRow } from '@/components/notification-row';
import { AppText } from '@/components/text';
import { AppView } from '@/components/view';
import { Colors, Fonts } from '@/constants/theme';
import { useAuthContext } from '@/hooks/use-auth-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useNotificationRealtime } from '@/hooks/use-notification-realtime';
import { notifyNotificationsRead } from '@/hooks/use-unread-notifications';
import { supabase } from '@/lib/supabase';

type Notification = {
  id: string;
  type: string | null;
  message: string;
  timestamp: string;
  isRead: boolean;
  actor: FollowRequestActor | null;
  activityId: string | null;
  resolution?: 'accepted' | 'rejected';
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

  // Ids that were unread when seen during the current visit: they keep their blue dot
  // until the user leaves, even though they're already marked read in the database.
  const newThisVisit = useRef<Set<string>>(new Set());

  const isFocused = useIsFocused();
  const focusedRef = useRef(isFocused);
  useEffect(() => {
    focusedRef.current = isFocused;
  }, [isFocused]);

  useNotificationRealtime(async (incoming) => {
    if (notifications.some((n) => n.id === incoming.id)) return;
    const { data } = await supabase
      .from('notifications')
      .select(
        'id, type, message, is_read, created_at, actor_id, activity_id, actor:profiles!actor_id(id, full_name, profile_picture)'
      )
      .eq('id', incoming.id)
      .maybeSingle();

    if (!data) return;

    // Arrived while the tab is open, so it's been seen: mark it read (keeping its dot for this visit).
    if (focusedRef.current && !data.is_read) {
      newThisVisit.current.add(data.id);
      void markReadInDb([data.id]);
    }

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
          activityId: data.activity_id,
        },
        ...prev,
      ];
    });
  });

  /** Loads the list and returns the ids of the unread notifications it shows. */
  async function fetchNotifications(): Promise<string[]> {
    const { data, error } = await supabase
      .from('notifications')
      .select(
        'id, type, message, is_read, created_at, actor_id, activity_id, actor:profiles!actor_id(id, full_name, profile_picture)'
      )
      .order('created_at', { ascending: false });

    if (error || !data) {
      setLoading(false);
      return [];
    }

    // Check status of follow requests in follows table
    const followRequests = data.filter((n: any) => n.type === 'follow_request' && n.actor_id);
    const followStatusMap: Record<string, string> = {};

    if (currentUserId && followRequests.length > 0) {
      const actorIds = followRequests.map((n: any) => n.actor_id);
      const { data: followRows } = await supabase
        .from('follows')
        .select('follower_id, status')
        .eq('following_id', currentUserId)
        .in('follower_id', actorIds);

      if (followRows) {
        for (const f of followRows) {
          followStatusMap[f.follower_id] = f.status;
        }
      }
    }

    // Check status of activity join requests
    const joinRequests = data.filter(
      (n: any) => n.type === 'activity_join_request' && n.activity_id && n.actor_id
    );
    const joinStatusMap: Record<string, string> = {};

    if (joinRequests.length > 0) {
      const activityIds = [...new Set(joinRequests.map((n: any) => n.activity_id))];
      const { data: joinRows } = await supabase
        .from('activity_join_requests')
        .select('activity_id, requester_id, status')
        .in('activity_id', activityIds);

      if (joinRows) {
        for (const j of joinRows) {
          joinStatusMap[`${j.activity_id}_${j.requester_id}`] = j.status;
        }
      }
    }

    // Filter out notifications for follow requests that were deleted/cancelled
    const filtered = data.filter((n: any) => {
      if (n.type === 'follow_request' && n.actor_id && currentUserId) {
        const status = followStatusMap[n.actor_id];
        // If the row no longer exists in follows, the request was cancelled or already removed
        if (!status) {
          void supabase.from('notifications').delete().eq('id', n.id);
          return false;
        }
      }
      return true;
    });

    setNotifications(
      filtered.map((n: any) => {
        let resolution: 'accepted' | 'rejected' | undefined = undefined;

        if (n.type === 'follow_request' && n.actor_id) {
          const status = followStatusMap[n.actor_id];
          if (status === 'accepted') {
            resolution = 'accepted';
          }
        } else if (n.type === 'activity_join_request' && n.activity_id && n.actor_id) {
          const status = joinStatusMap[`${n.activity_id}_${n.actor_id}`];
          if (status === 'accepted') {
            resolution = 'accepted';
          } else if (status === 'rejected') {
            resolution = 'rejected';
          }
        }

        return {
          id: n.id,
          type: n.type,
          message: n.message,
          timestamp: formatTimestamp(n.created_at),
          isRead: n.is_read && !newThisVisit.current.has(n.id),
          actor: n.actor,
          activityId: n.activity_id,
          resolution,
        };
      })
    );
    setLoading(false);
    return filtered.filter((n: any) => !n.is_read).map((n: any) => n.id);
  }

  async function markReadInDb(ids: string[]) {
    const { error } = await supabase.from('notifications').update({ is_read: true }).in('id', ids);
    if (error) {
      console.error('[Notifications] mark read failed:', error);
      return;
    }
    notifyNotificationsRead();
  }

  /** Loads the list, then marks whatever was unread as read while keeping its dot for this visit. */
  async function loadAndMarkRead(isActive: () => boolean = () => true) {
    const unreadIds = await fetchNotifications();
    if (!isActive() || unreadIds.length === 0) return;
    unreadIds.forEach((id) => newThisVisit.current.add(id));
    await markReadInDb(unreadIds);
  }

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadAndMarkRead().finally(() => setRefreshing(false));
  }, [currentUserId]);

  // Opening the tab marks everything read. Unread rows keep their blue dot for this visit
  // so new items stand out, and the dots clear when the user leaves the tab.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      void loadAndMarkRead(() => active);
      return () => {
        active = false;
        newThisVisit.current.clear();
        setNotifications((prev) =>
          prev.some((n) => !n.isRead) ? prev.map((n) => ({ ...n, isRead: true })) : prev
        );
      };
    }, [currentUserId])
  );

  async function markAsRead(id: string) {
    newThisVisit.current.delete(id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
  }

  async function handleAccept(n: Notification) {
    if (!n.actor || !currentUserId) return;

    setNotifications((prev) =>
      prev.map((x) =>
        x.id === n.id ? { ...x, resolution: 'accepted', isRead: true } : x
      )
    );

    const { error: followErr } = await supabase
      .from('follows')
      .update({ status: 'accepted' })
      .eq('follower_id', n.actor.id)
      .eq('following_id', currentUserId);

    if (followErr) {
      console.error('[Notifications] update follow status failed:', followErr);
      setNotifications((prev) =>
        prev.map((x) =>
          x.id === n.id ? { ...x, resolution: undefined } : x
        )
      );
      return;
    }

    const { error: delErr } = await supabase.from('notifications').delete().eq('id', n.id);
    if (delErr) {
      console.error('[Notifications] delete notification failed:', delErr);
      await supabase.from('notifications').update({ is_read: true }).eq('id', n.id);
    }
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
      console.error('[Notifications] delete follow failed:', followErr);
      setNotifications(previous);
      return;
    }

    const { error: delErr } = await supabase.from('notifications').delete().eq('id', n.id);
    if (delErr) {
      console.error('[Notifications] delete notification failed:', delErr);
      await supabase.from('notifications').update({ is_read: true }).eq('id', n.id);
    }
  }

  async function handleAcceptJoinRequest(n: Notification) {
    if (!n.actor || !n.activityId) return;

    setNotifications((prev) =>
      prev.map((x) => (x.id === n.id ? { ...x, resolution: 'accepted', isRead: true } : x))
    );

    const { error } = await supabase
      .from('activity_join_requests')
      .update({ status: 'accepted' })
      .eq('activity_id', n.activityId)
      .eq('requester_id', n.actor.id);

    if (error) {
      setNotifications((prev) =>
        prev.map((x) => (x.id === n.id ? { ...x, resolution: undefined } : x))
      );
      return;
    }

    await supabase.from('notifications').delete().eq('id', n.id);
  }

  async function handleRejectJoinRequest(n: Notification) {
    if (!n.actor || !n.activityId) return;

    setNotifications((prev) =>
      prev.map((x) => (x.id === n.id ? { ...x, resolution: 'rejected', isRead: true } : x))
    );

    const { error } = await supabase
      .from('activity_join_requests')
      .update({ status: 'rejected' })
      .eq('activity_id', n.activityId)
      .eq('requester_id', n.actor.id);

    if (error) {
      setNotifications((prev) =>
        prev.map((x) => (x.id === n.id ? { ...x, resolution: undefined } : x))
      );
      return;
    }

    await supabase.from('notifications').delete().eq('id', n.id);
  }

  return (
    <AppView style={styles.container}>
      <TourTarget id="notification-heading" style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
        <AppText accessibilityRole="header" style={{ fontSize: 24, fontWeight: '700' }}>Notifications</AppText>
      </TourTarget>
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
                  isAccepted={item.resolution === 'accepted'}
                  onAccept={() => handleAccept(item)}
                  onReject={() => handleReject(item)}
                />
              );
            }
            if (item.type === 'activity_join_request' && item.actor) {
              return (
                <ActivityJoinRequestRow
                  actor={item.actor}
                  message={item.message}
                  timestamp={item.timestamp}
                  isRead={item.isRead}
                  resolution={item.resolution}
                  onAccept={() => handleAcceptJoinRequest(item)}
                  onReject={() => handleRejectJoinRequest(item)}
                />
              );
            }
            return (
              <NotificationRow
                id={item.id}
                message={item.message}
                timestamp={item.timestamp}
                isRead={item.isRead}
                actor={item.actor}
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
