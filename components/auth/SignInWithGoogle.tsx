import { Colors } from "@/constants/theme";
import { supabase } from "@/lib/supabase";
import { makeRedirectUri } from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useState } from "react";
import { StyleSheet, useColorScheme, ViewStyle } from "react-native";
import { Button } from "react-native-paper";

WebBrowser.maybeCompleteAuthSession();

const redirectTo = makeRedirectUri();

type Props = {
  onSuccess?: () => void;
  onError?: (message: string) => void;
  disabled?: boolean;
  style?: ViewStyle;
};

export default function GoogleSignInButton({
  onSuccess,
  onError,
  disabled,
  style,
}: Props) {
  const scheme = useColorScheme() ?? "light";
  const colors = Colors[scheme];
  const [isSigningIn, setIsSigningIn] = useState(false);

  const handlePress = useCallback(async () => {
    if (isSigningIn) return;
    setIsSigningIn(true);

    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          skipBrowserRedirect: true,
        },
      });

      if (error) throw error;
      if (!data?.url)
        throw new Error("Supabase did not return an authorization URL.");
      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        redirectTo,
      );

      if (result.type !== "success") return;
      const url = new URL(result.url);
      const code = url.searchParams.get("code");
      const errorDescription = url.searchParams.get("error_description");

      if (errorDescription) throw new Error(errorDescription);
      if (!code) throw new Error("No authorization code in the redirect URL.");
      const { error: exchangeError } =
        await supabase.auth.exchangeCodeForSession(code);
      if (exchangeError) throw exchangeError;

      onSuccess?.();
    } catch (e) {
      console.error("Google sign-in failed:", e);
      onError?.("Could not sign in with Google. Please try again.");
    } finally {
      setIsSigningIn(false);
    }
  }, [isSigningIn, onSuccess, onError]);

  return (
    <Button
      mode="outlined"
      icon="google"
      onPress={handlePress}
      loading={isSigningIn}
      disabled={disabled || isSigningIn}
      textColor={colors.text}
      style={[
        styles.googleButton,
        { borderColor: colors.outlineVariant },
        style,
      ]}
      contentStyle={styles.googleButtonContent}
      labelStyle={styles.googleButtonLabel}
    >
      {isSigningIn ? "Signing in…" : "Continue with Google"}
    </Button>
  );
}

const styles = StyleSheet.create({
  googleButton: {
    borderRadius: 12,
    borderWidth: 1,
  },
  googleButtonContent: {
    height: 52,
  },
  googleButtonLabel: {
    fontSize: 16,
    fontWeight: "500",
  },
});
