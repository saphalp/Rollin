import { AppText } from "@/components/text";
import { Colors, Fonts } from "@/constants/theme";
import { StyleSheet, View } from "react-native";

type StatusPillProps = {
  label: string;
  tone: "warning" | "success";
};

export default function StatusPill({ label, tone }: StatusPillProps) {
  const colors = Colors.light;

  const backgroundColor = tone === "success" ? colors.verified : colors.secondaryContainer;
  const textColor = tone === "success" ? colors.onPrimary : colors.onSecondaryContainer;

  return (
    <View style={[styles.pill, { backgroundColor }]}>
      <AppText style={[styles.text, { color: textColor, fontFamily: Fonts.sans }]}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },

  text: {
    fontSize: 11,
    fontWeight: "700",
  },
});
