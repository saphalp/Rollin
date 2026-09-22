import { Image } from "expo-image";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Text } from "react-native-paper";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors, Fonts } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

type SharedContentBubbleProps = {
  fromMe: boolean;
  time: string;
  senderName?: string;
  kind: "activity" | "post";
  title: string;
  subtitle: string;
  imageUrl: string;
  onPress: () => void;
};

export default function SharedContentBubble({
  fromMe,
  time,
  senderName,
  kind,
  title,
  subtitle,
  imageUrl,
  onPress,
}: SharedContentBubbleProps) {
  const theme = useColorScheme() ?? "light";
  const colors = Colors[theme];

  const bubbleColor = fromMe ? colors.tint : colors.surfaceContainerHigh;
  const textColor = fromMe ? colors.onPrimary : colors.text;
  const subtitleColor = fromMe ? "rgba(255,255,255,0.8)" : colors.outline;
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
        {senderName && (
          <Text
            style={[styles.senderName, { color: colors.tint, fontFamily: Fonts.sans }]}
          >
            {senderName}
          </Text>
        )}

        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.85}
          onPress={onPress}
        >
          <Image
            source={{ uri: imageUrl }}
            style={styles.thumbnail}
            contentFit="cover"
          />

          <View style={styles.cardText}>
            <View style={styles.kindRow}>
              <IconSymbol
                name={kind === "activity" ? "calendar" : "camera.fill"}
                size={12}
                color={textColor}
              />
              <Text
                style={[
                  styles.kindLabel,
                  { color: textColor, fontFamily: Fonts.sans },
                ]}
              >
                {kind === "activity" ? "Activity" : "Post"}
              </Text>
            </View>

            <Text
              numberOfLines={2}
              style={[styles.title, { color: textColor, fontFamily: Fonts.sans }]}
            >
              {title}
            </Text>

            <Text
              numberOfLines={1}
              style={[
                styles.subtitle,
                { color: subtitleColor, fontFamily: Fonts.sans },
              ]}
            >
              {subtitle}
            </Text>
          </View>
        </TouchableOpacity>

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
    padding: 8,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    gap: 4,
  },
  senderName: {
    fontSize: 12,
    fontWeight: "700",
    marginLeft: 4,
    marginTop: 2,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 2,
  },
  thumbnail: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: "#DDDDDD",
  },
  cardText: {
    flex: 1,
    gap: 2,
  },
  kindRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  kindLabel: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    opacity: 0.8,
  },
  title: {
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 18,
  },
  subtitle: {
    fontSize: 12,
  },
  time: {
    fontSize: 10,
    fontWeight: "500",
    alignSelf: "flex-end",
    marginTop: 2,
  },
});
