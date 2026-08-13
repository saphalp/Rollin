import { Colors, Fonts } from "@/constants/theme";
import { supabase } from "@/lib/supabase";
import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, View, useColorScheme } from "react-native";
import { Button, Text, TextInput } from "react-native-paper";
import GoogleSignInButton from "./SignInWithGoogle";

interface LoginProps {
  onSignUpClick: () => void;
}

export default function Login({ onSignUpClick }: LoginProps) {
  const scheme = useColorScheme() ?? "light";
  const colors = Colors[scheme];

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  async function handleLogin() {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      setLoginError("Enter both your email and password.");
      return;
    }

    setLoginError("");
    setIsLoggingIn(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    setIsLoggingIn(false);

    if (error) {
      setLoginError(
        error.code === "invalid_credentials"
          ? "Incorrect email or password."
          : "Unable to log in right now. Please try again.",
      );
      return;
    }

    if (data.user?.confirmed_at) {
      router.replace("/(tabs)");
    } else if (data.user) {
      router.replace("/(auth)/EmailConfirmation");
    }
  }

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
        onChangeText={(value) => {
          setEmail(value);
          if (loginError) setLoginError("");
        }}
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
        onChangeText={(value) => {
          setPassword(value);
          if (loginError) setLoginError("");
        }}
        autoCapitalize="none"
        secureTextEntry={!isPasswordVisible}
        right={
          <TextInput.Icon
            icon={isPasswordVisible ? "eye" : "eye-off"}
            onPress={() => setIsPasswordVisible((visible) => !visible)}
            forceTextInputFocus={false}
          />
        }
        style={[styles.input, { backgroundColor: colors.surface }]}
        outlineColor={colors.outlineVariant}
        activeOutlineColor={colors.tint}
        textColor={colors.text}
        placeholderTextColor={colors.icon}
        theme={{ roundness: 15 }}
      />

      {loginError ? (
        <Text style={[styles.error, { color: colors.error }]}>{loginError}</Text>
      ) : null}

      <Button
        mode="text"
        compact
        onPress={() => router.push("/(auth)/forgot-password" as never)}
        textColor={colors.tint}
        style={styles.forgotButton}
        labelStyle={styles.forgotButtonLabel}
      >
        Forgot password?
      </Button>

      <Button
        mode="contained"
        onPress={handleLogin}
        loading={isLoggingIn}
        disabled={isLoggingIn}
        buttonColor={colors.tint}
        textColor={colors.onPrimary}
        style={styles.nextButton}
        contentStyle={styles.nextButtonContent}
        labelStyle={styles.nextButtonLabel}
      >
        Log In
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

      <GoogleSignInButton />

      <Text
        style={[
          styles.signupRow,
          { color: colors.text, fontFamily: Fonts.sans },
        ]}
      >
        Don&apos;t have an account?{" "}
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
  error: {
    fontSize: 13,
    lineHeight: 18,
  },
  forgotButton: {
    alignSelf: "flex-end",
  },
  forgotButtonLabel: {
    fontWeight: "600",
    marginHorizontal: 0,
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
  signupRow: {
    textAlign: "center",
    fontSize: 14,
    marginTop: 4,
  },
});
