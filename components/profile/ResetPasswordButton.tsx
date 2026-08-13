import { Colors } from "@/constants/theme";
import { supabase } from "@/lib/supabase";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, StyleSheet, useColorScheme } from "react-native";
import { Button } from "react-native-paper";

interface ResetPasswordButtonProps {
  email: string;
}

export default function ResetPasswordButton({
  email,
}: ResetPasswordButtonProps) {
  const theme = useColorScheme() ?? "light";
  const colors = Colors[theme];
  const [isSending, setIsSending] = useState(false);

  function confirmReset() {
    Alert.alert(
      "Reset password?",
      `We'll send a password reset code to ${email}.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Send Code",
          onPress: sendResetCode,
        },
      ],
    );
  }

  async function sendResetCode() {
    if (isSending) return;

    const normalizedEmail = email.trim().toLowerCase();
    setIsSending(true);

    const { error } = await supabase.auth.resetPasswordForEmail(
      normalizedEmail,
    );

    setIsSending(false);

    if (error) {
      Alert.alert(
        "Unable to send reset code",
        error.status === 429
          ? "Please wait before requesting another code."
          : "Please check your connection and try again.",
      );
      return;
    }

    router.push({
      pathname: "/reset-password",
      params: {
        email: normalizedEmail,
        source: "profile",
      },
    } as never);
  }

  return (
    <Button
      mode="outlined"
      icon="lock-reset"
      onPress={confirmReset}
      loading={isSending}
      disabled={isSending}
      textColor={colors.tint}
      style={[styles.button, { borderColor: colors.tint }]}
      contentStyle={styles.buttonContent}
      labelStyle={styles.buttonLabel}
    >
      Reset Password
    </Button>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 12,
  },
  buttonContent: {
    height: 48,
  },
  buttonLabel: {
    fontSize: 14,
    fontWeight: "700",
  },
});
