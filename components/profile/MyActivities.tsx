import { Colors, Fonts } from "@/constants/theme";
import { IconSymbol } from "@/components/ui/icon-symbol";
import {
  Image,
  ImageSourcePropType,
  Pressable,
  StyleSheet,
  useColorScheme,
  View,
} from "react-native";
import { Text } from "react-native-paper";

interface MyActivitiesProps {
  title: string;
  date: string;
  time: string;
  image: ImageSourcePropType;
  onPress?: () => void;
}

export default function MyActivities({
  title,
  date,
  time,
  image,
  onPress,
}: MyActivitiesProps) {
  const theme = useColorScheme() ?? "light";
  const colors = Colors[theme];

  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: colors.outlineVariant }}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.outlineVariant,
          shadowColor: colors.text,
          opacity: pressed ? 0.92 : 1,
        },
      ]}
    >
      <View style={styles.imageWrap}>
        <Image source={image} style={styles.image} />
        <View
          style={[
            styles.imageOverlay,
            { borderColor: colors.outlineVariant },
          ]}
        />
      </View>

      <View style={styles.content}>
        <Text
          numberOfLines={2}
          style={[styles.title, { color: colors.text, fontFamily: Fonts.sans }]}
        >
          {title}
        </Text>

        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <IconSymbol name="calendar" size={13} color={colors.tint} />
            <Text
              numberOfLines={1}
              style={[
                styles.meta,
                { color: colors.text, fontFamily: Fonts.sans },
              ]}
            >
              {date}
            </Text>
          </View>

          <View style={[styles.dot, { backgroundColor: colors.icon }]} />

          <View style={styles.metaItem}>
            <IconSymbol name="clock" size={13} color={colors.tint} />
            <Text
              numberOfLines={1}
              style={[
                styles.meta,
                { color: colors.text, fontFamily: Fonts.sans },
              ]}
            >
              {time}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.chevronWrap}>
        <IconSymbol name="chevron.right" size={18} color={colors.icon} />
      </View>
    </Pressable>
  );
}

const IMAGE_SIZE = 84;

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 12,
    borderRadius: 18,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  imageWrap: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
    borderRadius: 14,
    overflow: "hidden",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  content: {
    flex: 1,
    gap: 8,
    justifyContent: "center",
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: -0.2,
    lineHeight: 20,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  meta: {
    fontSize: 12,
    fontWeight: "500",
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    opacity: 0.5,
  },
  chevronWrap: {
    paddingLeft: 4,
    paddingRight: 2,
  },
});
