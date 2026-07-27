import { StyleSheet, TouchableOpacity, View } from 'react-native';

import { AppText } from '@/components/text';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export type NotificationItem = {
  id: string;
  message: string;
  timestamp: string;
  isRead: boolean;
};

type Props = NotificationItem & {
  onPress: (id: string) => void;
};

export function NotificationRow({ id, message, timestamp, isRead, onPress }: Props) {
  const theme = useColorScheme() ?? 'light';
  const colors = Colors[theme];

  return (
    <TouchableOpacity
      style={[styles.row, { borderBottomColor: colors.outlineVariant }]}
      onPress={() => onPress(id)}
      activeOpacity={0.7}
    >
      <View style={[styles.avatar, { backgroundColor: colors.surfaceContainerHigh }]} />
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
  avatar: {
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
