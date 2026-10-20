import { Colors, Fonts } from "@/constants/theme";
import { Pressable, StyleSheet, useColorScheme } from "react-native";
import { Text } from "react-native-paper";

interface StatsCardProps {
  label: string;
  score: number | string;
  onPress?: () => void;
}

export default function StatsCard({ label, score, onPress }: StatsCardProps) {
  const theme = useColorScheme() ?? "light";
  const colors = Colors[theme];

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={`${score} ${label}`}
      style={({ pressed }) => [styles.container, pressed && styles.pressed]}
    >
      <Text
        style={[
          styles.score,
          { color: colors.secondaryContainer, fontFamily: Fonts.sans },
        ]}
      >
        {score}
      </Text>
      <Text
        style={[styles.label, { color: colors.icon, fontFamily: Fonts.sans }]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  pressed: {
    opacity: 0.6,
  },
  score: {
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  label: {
    fontSize: 12,
    fontWeight: "500",
    textTransform: "capitalize",
  },
});
