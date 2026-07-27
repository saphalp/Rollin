import { Colors, Fonts } from "@/constants/theme";
import { StyleSheet, useColorScheme, View } from "react-native";
import { Text } from "react-native-paper";

interface StatsCardProps {
  label: string;
  score: number | string;
}

export default function StatsCard({ label, score }: StatsCardProps) {
  const theme = useColorScheme() ?? "light";
  const colors = Colors[theme];

  return (
    <View style={styles.container}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
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
