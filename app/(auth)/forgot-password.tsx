import AuthHeader from "@/components/auth/AuthHeader";
import { Colors, Fonts } from "@/constants/theme";
import { supabase } from "@/lib/supabase";
import { router } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  useColorScheme,
} from "react-native";
import { Button, Text, TextInput } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

export default function ForgotPasswordScreen() {
  const scheme = useColorScheme() ?? "light";
  const colors = Colors[scheme];
  const [email, setEmail] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSending, setIsSending] = useState(false);

  async function sendResetCode() {
    const normalizedEmail = email.trim().toLowerCase();

    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      setErrorMessage("Enter a valid email address.");
      return;
    }

    setErrorMessage("");
    setIsSending(true);

    const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail);

    setIsSending(false);

    if (error) {
      console.error("Password reset request failed:", error);
      setErrorMessage(
        error.status === 429
          ? "Please wait before requesting another code."
          : "We couldn't send a reset code. Check your connection and try again.",
      );
      return;
    }

    router.replace({
      pathname: "/reset-password",
      params: { email: normalizedEmail },
    } as never);
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
              {
                backgroundColor: colors.surfaceContainer,
                borderColor: colors.outlineVariant,
              },
            ]}
          >
            <Text style={[styles.title, { color: colors.text, fontFamily: Fonts.sans }]}>
              Forgot password?
            </Text>
            <Text style={[styles.description, { color: colors.icon }]}>
              Enter the email address associated with your Rollin account. We’ll send you a reset code.
            </Text>

            <TextInput
              mode="outlined"
              label="Email"
              value={email}
              onChangeText={(value) => {
                setEmail(value);
                if (errorMessage) setErrorMessage("");
              }}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              returnKeyType="send"
              onSubmitEditing={sendResetCode}
              style={[styles.input, { backgroundColor: colors.surface }]}
              outlineColor={colors.outlineVariant}
              activeOutlineColor={colors.tint}
              textColor={colors.text}
              placeholderTextColor={colors.icon}
              theme={{ roundness: 15 }}
            />

            {errorMessage ? (
              <Text style={[styles.error, { color: colors.error }]}>{errorMessage}</Text>
            ) : null}

            <Button
              mode="contained"
              onPress={sendResetCode}
              loading={isSending}
              disabled={isSending}
              buttonColor={colors.tint}
              textColor={colors.onPrimary}
              contentStyle={styles.buttonContent}
            >
              Send reset code
            </Button>

            <Button
              mode="text"
              onPress={() => router.replace("/(auth)")}
              disabled={isSending}
              textColor={colors.tint}
            >
              Back to login
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
  input: { fontSize: 14 },
  error: { fontSize: 13, lineHeight: 18 },
  buttonContent: { height: 52 },
});
