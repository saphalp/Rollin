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
  imageUrl: string;
  onPress: () => void;
} & (
  | { kind: "activity"; title: string; hostName: string }
  | { kind: "post"; posterName: string; caption: string | null }
);

export default function SharedContentBubble(props: SharedContentBubbleProps) {
  const { fromMe, time, senderName, imageUrl, onPress, kind } = props;

  const theme = useColorScheme() ?? "light";
  const colors = Colors[theme];

  const bubbleColor = fromMe ? colors.tint : colors.surfaceContainerHigh;
  const textColor = fromMe ? colors.onPrimary : colors.text;
  const metaColor = fromMe ? "rgba(255,255,255,0.82)" : colors.outline;
  const timeColor = fromMe ? colors.onPrimary : colors.icon;

  return (
    <View style={[styles.row, fromMe ? styles.rowMe : styles.rowThem]}>
      <View
        style={[
          styles.bubble,
          {
            backgroundColor: bubbleColor,
            borderBottomRightRadius: fromMe ? 4 : 20,
            borderBottomLeftRadius: fromMe ? 20 : 4,
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

        <TouchableOpacity activeOpacity={0.9} onPress={onPress}>
          <Image
            source={{ uri: imageUrl }}
            style={styles.previewImage}
            contentFit="cover"
          />

          <View style={styles.cardBody}>
            <View style={styles.kindRow}>
              <IconSymbol
                name={kind === "activity" ? "calendar" : "camera.fill"}
                size={12}
                color={metaColor}
              />
              <Text
                style={[
                  styles.kindLabel,
                  { color: metaColor, fontFamily: Fonts.sans },
                ]}
              >
                {kind === "activity" ? "Activity" : "Post"}
              </Text>
            </View>

            {kind === "activity" ? (
              <>
                <Text
                  numberOfLines={2}
                  style={[styles.title, { color: textColor, fontFamily: Fonts.sans }]}
                >
                  {props.title}
                </Text>

                <Text
                  numberOfLines={1}
                  style={[styles.meta, { color: metaColor, fontFamily: Fonts.sans }]}
                >
                  Hosted by {props.hostName}
                </Text>
              </>
            ) : (
              <>
                <Text
                  numberOfLines={1}
                  style={[styles.title, { color: textColor, fontFamily: Fonts.sans }]}
                >
                  {props.posterName}
                </Text>

                <Text
                  numberOfLines={2}
                  style={[styles.meta, { color: metaColor, fontFamily: Fonts.sans }]}
                >
                  {props.caption?.trim() ? props.caption : "Shared a photo"}
                </Text>
              </>
            )}
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
    width: "72%",
    overflow: "hidden",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 6,
  },
  senderName: {
    fontSize: 12,
    fontWeight: "700",
    marginTop: 8,
    marginHorizontal: 12,
    marginBottom: 4,
  },
  previewImage: {
    width: "100%",
    aspectRatio: 4 / 3,
    backgroundColor: "#DDDDDD",
  },
  cardBody: {
    paddingHorizontal: 12,
    paddingTop: 10,
    gap: 3,
  },
  kindRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 1,
  },
  kindLabel: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.3,
    opacity: 0.85,
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 19,
  },
  meta: {
    fontSize: 12,
    lineHeight: 16,
  },
  time: {
    fontSize: 10,
    fontWeight: "500",
    alignSelf: "flex-end",
    marginTop: 4,
    marginRight: 12,
  },
});
