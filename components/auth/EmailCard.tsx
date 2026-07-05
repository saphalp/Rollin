import { Colors, Fonts } from "@/constants/theme"; // adjust path to your theme file
import { useState } from "react";
import { StyleSheet, View, useColorScheme } from "react-native";
import { Button, Text, TextInput } from "react-native-paper";

export default function EmailCard() {
  const scheme = useColorScheme() ?? "light";
  const colors = Colors[scheme];

  const [email, setEmail] = useState("");

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surfaceContainer,
          borderColor: colors.outlineVariant,
        },
      ]}
    >
      <Text
        style={[styles.title, { color: colors.text, fontFamily: Fonts.sans }]}
      >
        Email
      </Text>

      <TextInput
        mode="outlined"
        placeholder="example@latech.edu"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        style={[styles.input, { backgroundColor: colors.surface }]}
        outlineColor={colors.outlineVariant}
        activeOutlineColor={colors.tint}
        textColor={colors.text}
        placeholderTextColor={colors.icon}
        theme={{ roundness: 15 }}
      />

      <Text
        style={[styles.helper, { color: colors.text, fontFamily: Fonts.sans }]}
      >
        Use your university email to get a verified badge
      </Text>

      <Button
        mode="contained"
        onPress={() => {}}
        buttonColor={colors.tint}
        textColor={colors.onPrimary}
        style={styles.nextButton}
        contentStyle={styles.nextButtonContent}
        labelStyle={styles.nextButtonLabel}
      >
        Next
      </Button>

      <Text
        style={[
          styles.loginRow,
          { color: colors.text, fontFamily: Fonts.sans },
        ]}
      >
        Already have an account?{" "}
        <Text
          style={{ color: colors.tint, fontWeight: "600" }}
          onPress={() => {}}
        >
          Log In
        </Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 24,
    gap: 10,
    marginVertical: 25,
  },
  title: {
    fontSize: 14,
    fontWeight: "700",
  },
  input: {
    fontSize: 14,
  },
  helper: {
    fontSize: 14,
  },
  nextButton: {
    borderRadius: 12,
    marginTop: 8,
  },
  nextButtonContent: {
    height: 56,
  },
  nextButtonLabel: {
    fontSize: 22,
    fontWeight: "700",
  },
  loginRow: {
    textAlign: "center",
    fontSize: 14,
    marginTop: 4,
  },
});
