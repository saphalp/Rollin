import { useState } from 'react';
import { FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NotificationRow, NotificationItem } from '@/components/notification-row';
import { AppText } from '@/components/text';
import { AppView } from '@/components/view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { router } from 'expo-router';

const SAMPLE_NOTIFICATIONS: NotificationItem[] = [
  { id: '1', message: 'Your ride to Hike to Lost Valley was confirmed', timestamp: '5m ago', isRead: false },
  { id: '2', message: "Maya RSVP'd to your Grocery Run", timestamp: '10m ago', isRead: false },
  { id: '3', message: 'New message from Ram Sir', timestamp: '33m ago', isRead: true },
  { id: '4', message: 'Hike to Lost Valley starts in 1 hour', timestamp: '56m ago', isRead: true },
  { id: '5', message: 'Hari requested to join your ride', timestamp: 'Yesterday', isRead: true },
];

export default function NotificationsScreen() {
  const theme = useColorScheme() ?? 'light';
  const colors = Colors[theme];
  const insets = useSafeAreaInsets();
  const [notifications, setNotifications] = useState(SAMPLE_NOTIFICATIONS);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const markAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
  };

  return (
    <AppView style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: colors.outlineVariant }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <IconSymbol name="chevron.left" size={24} color={colors.text} />
        </TouchableOpacity>
        <AppText style={[styles.title, { color: colors.tint, fontFamily: Fonts?.rounded }]}>
          Rollin'
        </AppText>
        <View style={styles.bellWrapper}>
          <IconSymbol name="bell.fill" size={24} color={colors.text} />
          {unreadCount > 0 && (
            <View style={[styles.badge, { backgroundColor: colors.tint }]}>
              <AppText style={[styles.badgeText, { color: colors.onPrimary, fontFamily: Fonts?.sans }]}>
                {unreadCount}
              </AppText>
            </View>
          )}
        </View>
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <NotificationRow {...item} onPress={markAsRead} />
        )}
        contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
      />
    </AppView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
  },
  bellWrapper: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
});
