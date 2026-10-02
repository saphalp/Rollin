import { supabase } from "@/lib/supabase";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { Button, TextInput } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg2, { Path, Rect } from "react-native-svg";

export default function EmailVerificationScreen() {
  const params = useLocalSearchParams<{ email?: string }>();
  const email = typeof params.email === "string" ? params.email.trim().toLowerCase() : "";
  const [code, setCode] = useState("");
  const [action, setAction] = useState<"verify" | "resend" | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [notice, setNotice] = useState("");
  const [resendSeconds, setResendSeconds] = useState(0);
  const pending = useRef(false);

  useEffect(() => {
    if (resendSeconds === 0) return;
    const timer = setTimeout(() => setResendSeconds((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendSeconds]);

  async function verifyCode() {
    if (pending.current || !email) return;
    if (!/^\d{6,8}$/.test(code.trim())) {
      setErrorMessage("Enter the numeric code from your verification email.");
      return;
    }

    pending.current = true;
    setAction("verify");
    setErrorMessage("");
    setNotice("");
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token: code.trim(),
        type: "email",
      });
      if (error) {
        setErrorMessage(error.status === 429
          ? "Please wait before trying another code."
          : "That code is invalid or expired. Try again or request a new code.");
        return;
      }
      if (!data.session) {
        setErrorMessage("We couldn't sign you in. Return to login and try again.");
        return;
      }
      // The auth provider and protected routes handle onboarding after sign-in.
      setNotice("Email verified. Signing you in…");
    } catch {
      setErrorMessage("Couldn't verify your code. Check your connection and try again.");
    } finally {
      pending.current = false;
      setAction(null);
    }
  }

  async function resendCode() {
    if (pending.current || !email || resendSeconds > 0) return;
    pending.current = true;
    setAction("resend");
    setErrorMessage("");
    setNotice("");
    try {
      const { error } = await supabase.auth.resend({ type: "signup", email });
      if (error) {
        if (error.status === 429) setResendSeconds(60);
        setErrorMessage(error.status === 429
          ? "Please wait before requesting another code."
          : "Couldn't send a code. Please try again shortly.");
        return;
      }
      setCode("");
      setResendSeconds(60);
      setNotice("A new code was requested. Check your inbox and spam folder.");
    } catch {
      setErrorMessage("Couldn't send a code. Check your connection and try again.");
    } finally {
      pending.current = false;
      setAction(null);
    }
  }

  if (!email) return <Redirect href="/(auth)" />;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <Svg2 width={90} height={70} viewBox="0 0 90 70" style={styles.icon}>
              <Rect x="2" y="8" width="86" height="56" rx="8" fill="#ffffff" />
              <Path d="M8 16 L45 42 L82 16" stroke="#3b63d6" strokeWidth={5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </Svg2>
            <Text style={styles.title}>Verify your email</Text>
            <Text style={styles.body}>Enter the code sent to {email} to activate your account. Need a new code? Use Resend code below.</Text>
            <TextInput
              mode="outlined"
              label="Verification code"
              value={code}
              onChangeText={(value) => { setCode(value); setErrorMessage(""); setNotice(""); }}
              keyboardType="number-pad"
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={8}
              editable={!action}
              onSubmitEditing={verifyCode}
              style={styles.input}
              textColor="#17213a"
              activeOutlineColor="#17213a"
              theme={{ colors: { onSurfaceVariant: "#46516a" } }}
            />
            {errorMessage ? <Text accessibilityRole="alert" style={styles.message}>{errorMessage}</Text> : null}
            {notice ? <Text accessibilityLiveRegion="polite" style={styles.body}>{notice}</Text> : null}
            <Button mode="contained" onPress={verifyCode} loading={action === "verify"} disabled={!!action} buttonColor="#ffffff" textColor="#2449aa" style={styles.button}>Verify code</Button>
            <Button mode="text" onPress={resendCode} loading={action === "resend"} disabled={!!action || resendSeconds > 0} textColor="#ffffff" style={styles.button}>
              {resendSeconds > 0 ? `Resend in ${resendSeconds}s` : "Resend code"}
            </Button>
          </View>
          <Button mode="outlined" onPress={() => router.replace({ pathname: "/(auth)", params: { mode: "login" } })} disabled={!!action} textColor="#ffffff" style={styles.loginButton}>Back to login</Button>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#3b63d6" },
  flex: { flex: 1 },
  content: { flexGrow: 1, padding: 24, alignItems: "center" },
  card: { backgroundColor: "rgba(255,255,255,0.14)", borderRadius: 16, padding: 24, width: "100%", maxWidth: 400, alignItems: "center", gap: 16 },
  icon: { marginBottom: 8 },
  title: { fontSize: 22, fontWeight: "500", color: "#ffffff", textAlign: "center" },
  body: { fontSize: 14, lineHeight: 22, color: "#ffffff", textAlign: "center" },
  message: { fontSize: 14, lineHeight: 22, color: "#ffffff", fontWeight: "600", textAlign: "center" },
  input: { width: "100%", backgroundColor: "#ffffff" },
  button: { width: "100%" },
  loginButton: { borderColor: "#ffffff", width: "100%", maxWidth: 400, marginTop: 24 },
});
