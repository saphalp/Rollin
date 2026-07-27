import { Colors, Fonts } from "@/constants/theme";
import { StyleSheet, useColorScheme, View } from "react-native";
import { Text } from "react-native-paper";

interface ProfileInfoProps {
  name: string;
  university: string;
  major: string;
}

export default function ProfileInfo({
  name,
  university,
  major,
}: ProfileInfoProps) {
  const scheme = useColorScheme() ?? "light";
  const colors = Colors[scheme];

  return (
    <View style={styles.container}>
      <Text
        numberOfLines={1}
        style={[styles.name, { color: colors.text, fontFamily: Fonts.sans }]}
      >
        {name}
      </Text>

      <View style={styles.metaRow}>
        <Text
          numberOfLines={1}
          style={[styles.meta, { color: colors.text, fontFamily: Fonts.sans }]}
        >
          {university}
        </Text>
        <View style={[styles.dot, { backgroundColor: colors.icon }]} />
        <Text
          numberOfLines={1}
          style={[styles.meta, { color: colors.icon, fontFamily: Fonts.sans }]}
        >
          {major}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
  },
  name: {
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  meta: {
    fontSize: 14,
    fontWeight: "500",
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    opacity: 0.6,
  },
});
