import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Avatar } from 'react-native-paper';

import { AppText } from '@/components/text';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { resolveAvatarUri } from '@/lib/profile/resolve-avatar-uri';

export type NotificationActor = {
  id: string;
  full_name: string | null;
  profile_picture: string | null;
};

export type NotificationItem = {
  id: string;
  message: string;
  timestamp: string;
  isRead: boolean;
  actor?: NotificationActor | null;
};

type Props = NotificationItem & {
  onPress: (id: string) => void;
};

export function NotificationRow({
  id,
  message,
  timestamp,
  isRead,
  actor,
  onPress,
}: Props) {
  const theme = useColorScheme() ?? 'light';
  const colors = Colors[theme];

  const actorName = actor?.full_name ?? '';
  const initial = actorName.trim()[0]?.toUpperCase() ?? '?';

  return (
    <TouchableOpacity
      style={[styles.row, { borderBottomColor: colors.outlineVariant }]}
      onPress={() => onPress(id)}
      activeOpacity={0.7}
    >
      {actor?.profile_picture ? (
        <Avatar.Image
          size={44}
          source={{ uri: resolveAvatarUri(actor.profile_picture) }}
        />
      ) : actor ? (
        <Avatar.Text
          size={44}
          label={initial}
          style={{ backgroundColor: colors.tint }}
          labelStyle={{ color: colors.onPrimary }}
        />
      ) : (
        <View
          style={[
            styles.placeholder,
            { backgroundColor: colors.surfaceContainerHigh },
          ]}
        />
      )}

      <View style={styles.body}>
        <AppText style={[styles.message, { color: colors.text, fontFamily: Fonts?.sans }]}>
          {message}
        </AppText>
        <AppText style={[styles.timestamp, { color: colors.outline, fontFamily: Fonts?.sans }]}>
          {timestamp}
        </AppText>
      </View>
      {!isRead && (
        <View style={[styles.dot, { backgroundColor: colors.tint }]} />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  placeholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    flexShrink: 0,
  },
  body: {
    flex: 1,
    gap: 4,
  },
  message: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
  timestamp: {
    fontSize: 12,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
});
