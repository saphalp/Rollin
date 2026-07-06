import { Colors, Fonts } from "@/constants/theme";
import { StyleSheet, useColorScheme } from "react-native";
import { Text } from "react-native-paper";

export default function TermsFooter() {
  const scheme = useColorScheme() ?? "light";
  const colors = Colors[scheme];

  return (
    <Text
      style={[styles.footer, { color: colors.outline, fontFamily: Fonts.sans }]}
    >
      By signing up, you agree to our{" "}
      <Text
        style={{ color: colors.text, fontWeight: "600" }}
        onPress={() => {}}
      >
        Terms
      </Text>{" "}
      and{" "}
      <Text
        style={{ color: colors.text, fontWeight: "600" }}
        onPress={() => {}}
      >
        Privacy Policy
      </Text>
      . We'll send a verification link to your inbox.
    </Text>
  );
}

const styles = StyleSheet.create({
  footer: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    paddingHorizontal: 16,
  },
});
