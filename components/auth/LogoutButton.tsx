import { supabase } from "@/lib/supabase";
import { Colors } from "@/constants/theme";
import { useState } from "react";
import { Alert, StyleSheet, useColorScheme } from "react-native";
import { Button } from "react-native-paper";

export default function LogoutButton() {
  const theme = useColorScheme() ?? "light";
  const colors = Colors[theme];
  const [isSigningOut, setIsSigningOut] = useState(false);

  function confirmSignOut() {
    Alert.alert(
      "Log out?",
      "You will need to sign in again to access your account.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Log Out",
          style: "destructive",
          onPress: signOut,
        },
      ],
    );
  }

  async function signOut() {
    if (isSigningOut) return;

    setIsSigningOut(true);
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("Error signing out:", error);
      Alert.alert(
        "Unable to log out",
        "Please check your connection and try again.",
      );
      setIsSigningOut(false);
    }
  }

  return (
    <Button
      mode="outlined"
      icon="logout"
      onPress={confirmSignOut}
      loading={isSigningOut}
      disabled={isSigningOut}
      textColor={colors.error}
      style={[styles.button, { borderColor: colors.error }]}
      contentStyle={styles.buttonContent}
      labelStyle={styles.buttonLabel}
    >
      Log Out
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
