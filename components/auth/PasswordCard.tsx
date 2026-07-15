import { Colors, Fonts } from "@/constants/theme";
import { supabase } from "@/lib/supabase";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, StyleSheet, View, useColorScheme } from "react-native";
import { Button, Text, TextInput } from "react-native-paper";

interface PasswordCardProps {
  email: string;
  onLoginClick: () => void;
  onSignUpSuccess: () => void;
}

export default function PasswordCard({
  email,
  onLoginClick,
  onSignUpSuccess,
}: PasswordCardProps) {
  const scheme = useColorScheme() ?? "light";
  const colors = Colors[scheme];

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
    const passwordsMatch = password.length > 0 && password === confirmPassword;
  const hasMinimumLength = password.length >= 8;
  const hasNumber = /\d/.test(password);

  const handleSignUp = () => {
    if (!hasMinimumLength) {
      Alert.alert("Invalid Password", "Password must be at least 8 characters.");
      return;
    }

    if (!hasNumber) {
      Alert.alert("Invalid Password", "Password must include at least one number.");
      return;
    }

    if (!passwordsMatch) {
      Alert.alert("Passwords Do Not Match", "Please make sure both passwords match.");
      return;
    }

    console.log("Signed up with:", {
      email,
      password,
    });

    onSignUpSuccess();
  };
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
        Password
      </Text>

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

      <TextInput
        mode="outlined"
        placeholder="Confirm password"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
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
        style={[styles.helper, { color: colors.text, fontFamily: Fonts.sans }]}
      >
        Use at least 8 characters, including a number
      </Text>
      <Button
        mode="contained"
        onPress={async () => {
          if (email && passwordsMatch) {
            const { data, error } = await supabase.auth.signUp({
              email,
              password,
            });
            if (error) console.log(error.message); // REMINDER to add error logic here
            data.user && router.replace("/EmailConfirmation");
          }
        }}
        buttonColor={colors.tint}
        textColor={colors.onPrimary}
        style={styles.nextButton}
        contentStyle={styles.nextButtonContent}
        labelStyle={styles.nextButtonLabel}
      >
        Sign Up
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
  loginRow: {
    textAlign: "center",
    fontSize: 14,
    marginTop: 4,
  },
});
