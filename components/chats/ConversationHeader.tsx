import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors, Fonts } from "@/constants/theme";
import { router } from "expo-router";
import {
  ImageSourcePropType,
  Pressable,
  StyleSheet,
  useColorScheme,
  View,
} from "react-native";
import { Avatar, Text } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface ConversationHeaderProps {
  name: string;
  avatar: ImageSourcePropType;
  subtitle?: string;
}

export default function ConversationHeader({
  name,
  avatar,
  subtitle,
}: ConversationHeaderProps) {
  const theme = useColorScheme() ?? "light";
  const colors = Colors[theme];
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.header,
        {
          paddingTop: insets.top + 8,
          backgroundColor: colors.background,
          borderBottomColor: colors.outlineVariant,
        },
      ]}
    >
      <Pressable
        onPress={() => router.back()}
        hitSlop={12}
        style={({ pressed }) => [
          styles.backButton,
          { opacity: pressed ? 0.6 : 1 },
        ]}
      >
        <IconSymbol name="chevron.left" size={26} color={colors.text} />
      </Pressable>

      <Avatar.Image size={38} source={avatar} />

      <View style={styles.nameCol}>
        <Text
          numberOfLines={1}
          style={[styles.name, { color: colors.text, fontFamily: Fonts.sans }]}
        >
          {name}
        </Text>
        {subtitle && (
          <Text
            numberOfLines={1}
            style={[
              styles.subtitle,
              { color: colors.icon, fontFamily: Fonts.sans },
            ]}
          >
            {subtitle}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    padding: 4,
  },
  nameCol: {
    flex: 1,
    gap: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: "500",
  },
});
