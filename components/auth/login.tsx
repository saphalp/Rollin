import { Colors, Fonts } from "@/constants/theme"; // adjust path to your theme file
import { useState } from "react";
import { StyleSheet, View, useColorScheme } from "react-native";
import { Button, Text, TextInput } from "react-native-paper";

interface LoginProps {
  onSignUpClick: () => void;
}

export default function Login({ onSignUpClick }: LoginProps) {
  const scheme = useColorScheme() ?? "light";
  const colors = Colors[scheme];

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

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
        Log In
      </Text>

      <TextInput
        mode="outlined"
        placeholder="Email"
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

      <TextInput
        mode="outlined"
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        autoCapitalize="none"
        secureTextEntry
        style={[styles.input, { backgroundColor: colors.surface }]}
        outlineColor={colors.outlineVariant}
        activeOutlineColor={colors.tint}
        textColor={colors.text}
        placeholderTextColor={colors.icon}
        theme={{ roundness: 15 }}
      />

      <Text
        style={{ color: colors.tint, fontWeight: "600", alignSelf: "flex-end" }}
        onPress={() => {}}
      >
        Forgot password?
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
        Log In
      </Button>

      <Text
        style={[
          styles.signupRow,
          { color: colors.text, fontFamily: Fonts.sans },
        ]}
      >
        Don't have an account?{" "}
        <Text
          style={{ color: colors.tint, fontWeight: "600" }}
          onPress={() => onSignUpClick()}
        >
          Sign Up
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
  signupRow: {
    textAlign: "center",
    fontSize: 14,
    marginTop: 4,
  },
});
