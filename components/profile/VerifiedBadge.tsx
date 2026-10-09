import { AppText } from "@/components/text";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors, Fonts } from "@/constants/theme";
import { StyleSheet, View } from "react-native";

export default function VerifiedBadge() {
  const colors = Colors.light;

  return (
    <View style={[styles.badge, { backgroundColor: colors.verified }]}>
      <IconSymbol name="checkmark" size={14} color={colors.onPrimary} />
      <AppText style={[styles.text, { color: colors.onPrimary, fontFamily: Fonts.sans }]}>
        License Verified
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
    borderRadius: 14,
  },

  text: {
    fontSize: 15,
    fontWeight: "700",
  },
});
