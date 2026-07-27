import { Colors, Fonts } from "@/constants/theme";
import { StyleSheet, useColorScheme, View } from "react-native";
import { Text } from "react-native-paper";

interface MessageBubbleProps {
  text: string;
  fromMe: boolean;
  time: string;
}

export default function MessageBubble({
  text,
  fromMe,
  time,
}: MessageBubbleProps) {
  const theme = useColorScheme() ?? "light";
  const colors = Colors[theme];

  const bubbleColor = fromMe ? colors.tint : colors.surfaceContainerHigh;
  const textColor = fromMe ? colors.onPrimary : colors.text;
  const timeColor = fromMe ? colors.onPrimary : colors.icon;

  return (
    <View style={[styles.row, fromMe ? styles.rowMe : styles.rowThem]}>
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
    paddingHorizontal: 12,
    marginVertical: 2,
  },
  rowMe: {
    justifyContent: "flex-end",
  },
  rowThem: {
    justifyContent: "flex-start",
  },
  bubble: {
    maxWidth: "78%",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    gap: 2,
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
