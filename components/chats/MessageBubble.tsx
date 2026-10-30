import { Colors, Fonts } from "@/constants/theme";
import { Image, Pressable, StyleSheet, useColorScheme, View } from "react-native";
import { Text } from "react-native-paper";

interface MessageBubbleProps {
  text: string;
  fromMe: boolean;
  time: string;
  senderName?: string;
  onPressSender?: () => void;
  avatarUri?: string;
  showAvatar?: boolean;
}

export default function MessageBubble({
  text,
  fromMe,
  time,
  senderName,
  onPressSender,
  avatarUri,
  showAvatar = false,
}: MessageBubbleProps) {
  const theme = useColorScheme() ?? "light";
  const colors = Colors[theme];

  const bubbleColor = fromMe ? colors.tint : colors.surfaceContainerHigh;
  const textColor = fromMe ? colors.onPrimary : colors.text;
  const timeColor = fromMe ? colors.onPrimary : colors.icon;

  return (
    <View style={[styles.row, fromMe ? styles.rowMe : styles.rowThem]}>
      {!fromMe && (
        <View style={styles.avatarSlot}>
          {showAvatar && avatarUri ? (
            <Pressable
              onPress={onPressSender}
              disabled={!onPressSender}
              accessibilityRole={onPressSender ? "button" : undefined}
              accessibilityLabel="Open sender profile"
              hitSlop={6}
            >
              <Image source={{ uri: avatarUri }} style={styles.avatar} />
            </Pressable>
          ) : null}
        </View>
      )}
      <View
        style={[
          styles.bubble,
          {
            backgroundColor: bubbleColor,
            borderBottomRightRadius: fromMe ? 4 : 18,
            borderBottomLeftRadius: fromMe ? 18 : 4,
          },
        ]}
      >
        {senderName && (
          <Pressable onPress={onPressSender} disabled={!onPressSender} hitSlop={6}>
            <Text
              style={[styles.senderName, { color: colors.tint, fontFamily: Fonts.sans }]}
            >
              {senderName}
            </Text>
          </Pressable>
        )}
        <Text
          style={[styles.text, { color: textColor, fontFamily: Fonts.sans }]}
        >
          {text}
        </Text>
        <Text
          style={[
            styles.time,
            {
              color: timeColor,
              fontFamily: Fonts.sans,
              opacity: fromMe ? 0.75 : 1,
            },
          ]}
        >
          {time}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    gap: 7,
    marginVertical: 2,
  },
  rowMe: {
    justifyContent: "flex-end",
  },
  rowThem: {
    justifyContent: "flex-start",
  },
  avatarSlot: {
    width: 30,
    height: 30,
    justifyContent: "center",
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  bubble: {
    maxWidth: "78%",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    gap: 2,
  },
  senderName: {
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 2,
  },
  text: {
    fontSize: 15,
    lineHeight: 20,
  },
  time: {
    fontSize: 10,
    fontWeight: "500",
    alignSelf: "flex-end",
  },
});
