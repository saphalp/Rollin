import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors, Fonts } from "@/constants/theme";
import { router } from "expo-router";
import type { ReactNode } from "react";
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
  muted?: boolean;
  onToggleMute?: () => void;
  onPressProfile?: () => void;
  right?: ReactNode;
}

export default function ConversationHeader({
  name,
  avatar,
  subtitle,
  muted = false,
  onToggleMute,
  onPressProfile,
  right,
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

      <Pressable
        onPress={onPressProfile}
        disabled={!onPressProfile}
        style={({ pressed }) => [
          styles.profilePressable,
          { opacity: pressed && onPressProfile ? 0.7 : 1 },
        ]}
        accessibilityRole="button"
        accessibilityLabel={`View ${name}'s profile`}
      >
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
      </Pressable>
      {onToggleMute && (
        <Pressable
          onPress={onToggleMute}
          hitSlop={12}
          style={({ pressed }) => [styles.backButton, { opacity: pressed ? 0.6 : 1 }]}
        >
          <IconSymbol
            name={muted ? "bell.slash.fill" : "bell.fill"}
            size={22}
            color={muted ? colors.icon : colors.text}
          />
        </Pressable>
      )}
      {right}
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
  profilePressable: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
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
