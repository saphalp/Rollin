import { Colors, Fonts } from "@/constants/theme";
import { useState } from "react";
import { StyleSheet, View, useColorScheme } from "react-native";
import { Button, Text, TextInput } from "react-native-paper";

interface EmailCardProps {
  email: string;
  onNext: (value: string) => void;
  onLoginClick: () => void;
}

export default function EmailCard({
  email,
  onNext,
  onLoginClick,
}: EmailCardProps) {
  const scheme = useColorScheme() ?? "light";
  const colors = Colors[scheme];

  const [value, setValue] = useState(email);

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
        value={value}
        onChangeText={setValue}
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
        onPress={() => {
          onNext(value);
        }}
        buttonColor={colors.tint}
        textColor={colors.onPrimary}
        style={styles.nextButton}
        contentStyle={styles.nextButtonContent}
        labelStyle={styles.nextButtonLabel}
      >
        Next
      </Button>

      <View style={styles.dividerRow}>
        <View
          style={[
            styles.dividerLine,
            { backgroundColor: colors.outlineVariant },
          ]}
        />
        <Text style={[styles.dividerText, { color: colors.icon }]}>OR</Text>
        <View
          style={[
            styles.dividerLine,
            { backgroundColor: colors.outlineVariant },
          ]}
        />
      </View>

      <Button
        mode="outlined"
        icon="google"
        onPress={() => {}}
        textColor={colors.text}
        style={[styles.googleButton, { borderColor: colors.outlineVariant }]}
        contentStyle={styles.nextButtonContent}
        labelStyle={styles.googleButtonLabel}
      >
        Continue with Google
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
          onPress={() => {
            onLoginClick();
          }}
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
    fontSize: 18,
    fontWeight: "700",
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 4,
    gap: 8,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 12,
    fontWeight: "600",
  },
  googleButton: {
    borderRadius: 12,
    borderWidth: 1,
  },
  googleButtonLabel: {
    fontSize: 16,
    fontWeight: "600",
  },
  loginRow: {
    textAlign: "center",
    fontSize: 14,
    marginTop: 4,
  },
});
