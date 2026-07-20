import { Colors, Fonts } from "@/constants/theme";
import {
  ImageSourcePropType,
  Pressable,
  StyleSheet,
  useColorScheme,
  View,
} from "react-native";
import { Avatar, Text } from "react-native-paper";

interface ChatCardProps {
  user: string;
  avatar: ImageSourcePropType;
  last_message: string;
  is_read: boolean;
  time: string;
  onPress?: () => void;
}

export default function ChatCards({
  user,
  avatar,
  last_message,
  is_read,
  time,
  onPress,
}: ChatCardProps) {
  const theme = useColorScheme() ?? "light";
  const colors = Colors[theme];

  const unread = !is_read;

  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: colors.outlineVariant }}
      style={({ pressed }) => [
        styles.card,
        { opacity: pressed ? 0.9 : 1 },
      ]}
    >
      <Avatar.Image size={52} source={avatar} />

      <View style={styles.content}>
        <View style={styles.topRow}>
          <Text
            numberOfLines={1}
            style={[
              styles.name,
              {
                color: colors.text,
                fontFamily: Fonts.sans,
                fontWeight: unread ? "700" : "600",
              },
            ]}
          >
            {user}
          </Text>
          <Text
            style={[
              styles.time,
              {
                color: unread ? colors.tint : colors.icon,
                fontFamily: Fonts.sans,
                fontWeight: unread ? "600" : "500",
              },
            ]}
          >
            {time}
          </Text>
        </View>

        <View style={styles.bottomRow}>
          <Text
            numberOfLines={1}
            style={[
              styles.message,
              {
                color: unread ? colors.text : colors.icon,
                fontFamily: Fonts.sans,
                fontWeight: unread ? "600" : "400",
              },
            ]}
          >
            {last_message}
          </Text>
          {unread && (
            <View
              style={[styles.unreadDot, { backgroundColor: colors.tint }]}
            />
          )}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  content: {
    flex: 1,
    gap: 4,
    justifyContent: "center",
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  name: {
    fontSize: 15,
    letterSpacing: -0.2,
    flex: 1,
  },
  time: {
    fontSize: 12,
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  message: {
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
