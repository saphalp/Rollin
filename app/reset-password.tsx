import AuthHeader from "@/components/auth/AuthHeader";
import { Colors, Fonts } from "@/constants/theme";
import { supabase } from "@/lib/supabase";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  useColorScheme,
} from "react-native";
import { Button, Text, TextInput } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

export default function ResetPasswordScreen() {
  const scheme = useColorScheme() ?? "light";
  const colors = Colors[scheme];
  const params = useLocalSearchParams<{
    email?: string;
    step?: string;
    error?: string;
    source?: string;
  }>();

  const email = params.email?.trim().toLowerCase() ?? "";
  const isChoosingPassword =
    params.step === "verifying" || params.step === "password";
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  useEffect(() => {
    if (!email) {
      router.replace("/(auth)");
    }
  }, [email]);

  async function verifyCode() {
    const normalizedCode = code.trim();

    if (!/^\d{6,8}$/.test(normalizedCode)) {
      Alert.alert("Enter the code", "Enter the numeric code from your reset email.");
      return;
    }

    setIsSubmitting(true);
    router.setParams({ step: "verifying", error: "" });
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: normalizedCode,
      type: "recovery",
    });
    setIsSubmitting(false);

    if (error) {
      console.error("Recovery code verification failed:", error);
      router.setParams({
        step: "verify",
        error: "That code is invalid or expired. Request a new code and try again.",
      });
      return;
    }

    router.replace({
      pathname: "/reset-password",
      params: {
        email,
        step: "password",
        source: params.source ?? "",
      },
    } as never);
  }

  async function updatePassword() {
    if (newPassword.length < 8) {
      setPasswordError("Use at least 8 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("The passwords do not match.");
      return;
    }

    setPasswordError("");
    setIsSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      setIsSubmitting(false);
      setPasswordError(
        error.message === "New password should be different from the old password."
          ? "Your new password must be different from your old password."
          : error.message,
      );
      return;
    }

    await supabase.auth.signOut();
    setIsSubmitting(false);

    Alert.alert("Password updated", "You can now log in with your new password.", [
      { text: "Return to login", onPress: () => router.replace("/(auth)") },
    ]);
  }

  async function returnToLogin() {
    if (params.source === "profile") {
      router.replace("/(tabs)/profile" as never);
      return;
    }

    setIsSubmitting(true);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session) {
      await supabase.auth.signOut();
    }

    setIsSubmitting(false);
    router.replace("/(auth)");
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <AuthHeader />
          <View
            style={[
              styles.card,
              { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant },
            ]}
          >
            <Text style={[styles.title, { color: colors.text, fontFamily: Fonts.sans }]}>
              {isChoosingPassword ? "Choose a new password" : "Verify reset code"}
            </Text>
            <Text style={[styles.description, { color: colors.icon }]}>
              {isChoosingPassword
                ? "Your code was verified. Enter the new password you want to use."
                : "Enter the code from your Rollin password reset email."}
            </Text>

            {!isChoosingPassword ? (
              <>
                <View style={styles.emailContainer}>
                  <Text style={[styles.emailLabel, { color: colors.icon }]}>Code sent to</Text>
                  <Text style={[styles.email, { color: colors.text }]}>{email}</Text>
                </View>
                <TextInput
                  mode="outlined"
                  label="Reset code"
                  value={code}
                  onChangeText={(value) => setCode(value.replace(/\D/g, ""))}
                  keyboardType="number-pad"
                  maxLength={8}
                  style={[styles.input, { backgroundColor: colors.surface }]}
                  outlineColor={colors.outlineVariant}
                  activeOutlineColor={colors.tint}
                  textColor={colors.text}
                  placeholderTextColor={colors.icon}
                />
                {params.error ? (
                  <Text style={[styles.error, { color: colors.error }]}>{params.error}</Text>
                ) : null}
                <Button
                  mode="contained"
                  onPress={verifyCode}
                  loading={isSubmitting}
                  disabled={isSubmitting}
                  buttonColor={colors.tint}
                  textColor={colors.onPrimary}
                  contentStyle={styles.buttonContent}
                >
                  Verify code
                </Button>
              </>
            ) : (
              <>
                <TextInput
                  mode="outlined"
                  label="New password"
                  value={newPassword}
                  onChangeText={(value) => {
                    setNewPassword(value);
                    if (passwordError) setPasswordError("");
                  }}
                  secureTextEntry={!isPasswordVisible}
                  right={
                    <TextInput.Icon
                      icon={isPasswordVisible ? "eye" : "eye-off"}
                      onPress={() => setIsPasswordVisible((visible) => !visible)}
                      forceTextInputFocus={false}
                    />
                  }
                  autoCapitalize="none"
                  style={[styles.input, { backgroundColor: colors.surface }]}
                  outlineColor={colors.outlineVariant}
                  activeOutlineColor={colors.tint}
                  textColor={colors.text}
                  placeholderTextColor={colors.icon}
                />
                <TextInput
                  mode="outlined"
                  label="Confirm new password"
                  value={confirmPassword}
                  onChangeText={(value) => {
                    setConfirmPassword(value);
                    if (passwordError) setPasswordError("");
                  }}
                  secureTextEntry={!isConfirmPasswordVisible}
                  right={
                    <TextInput.Icon
                      icon={isConfirmPasswordVisible ? "eye" : "eye-off"}
                      onPress={() =>
                        setIsConfirmPasswordVisible((visible) => !visible)
                      }
                      forceTextInputFocus={false}
                    />
                  }
                  autoCapitalize="none"
                  style={[styles.input, { backgroundColor: colors.surface }]}
                  outlineColor={colors.outlineVariant}
                  activeOutlineColor={colors.tint}
                  textColor={colors.text}
                  placeholderTextColor={colors.icon}
                />
                {passwordError ? (
                  <Text style={[styles.error, { color: colors.error }]}>
                    {passwordError}
                  </Text>
                ) : null}
                <Button
                  mode="contained"
                  onPress={updatePassword}
                  loading={isSubmitting}
                  disabled={isSubmitting}
                  buttonColor={colors.tint}
                  textColor={colors.onPrimary}
                  contentStyle={styles.buttonContent}
                >
                  Update password
                </Button>
              </>
            )}

            <Button
              mode="text"
              onPress={returnToLogin}
              disabled={isSubmitting}
              textColor={colors.tint}
            >
              {params.source === "profile" ? "Back to profile" : "Back to login"}
            </Button>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  flex: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 20, paddingBottom: 80 },
  card: { borderWidth: 1, borderRadius: 16, padding: 24, gap: 14 },
  title: { fontSize: 22, fontWeight: "700" },
  description: { fontSize: 14, lineHeight: 20, marginBottom: 4 },
  emailContainer: { gap: 2, marginBottom: 2 },
  emailLabel: { fontSize: 12, fontWeight: "600" },
  email: { fontSize: 16, fontWeight: "700" },
  input: { fontSize: 14 },
  error: { fontSize: 13, lineHeight: 18 },
  buttonContent: { height: 52 },
});
