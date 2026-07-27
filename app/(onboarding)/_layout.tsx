import ProfileAvatar from "@/components/profile/ProfileAvatar";
import { Colors, Fonts } from "@/constants/theme";
import { useAuthContext } from "@/hooks/use-auth-context";
import { completeProfile } from "@/lib/profile/complete-profile";

import { useState } from "react";
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    View,
} from "react-native";
import { Button, Text, TextInput } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

export default function Onboarding() {
  const { profile, refreshProfile } = useAuthContext();

  const colors = Colors.light;

  const [fullName, setFullName] = useState(
    profile?.full_name ?? ""
  );

  const [university, setUniversity] = useState(
    profile?.university ?? ""
  );

  const [major, setMajor] = useState(
    profile?.major ?? ""
  );

  const [isSaving, setIsSaving] = useState(false);

  async function handleFinish() {
    if (!fullName.trim()) {
      Alert.alert(
        "Missing name",
        "Please enter your full name."
      );
      return;
    }

    if (!university.trim()) {
      Alert.alert(
        "Missing university",
        "Please enter your university."
      );
      return;
    }

    if (!major.trim()) {
      Alert.alert(
        "Missing major",
        "Please enter your major."
      );
      return;
    }

    try {
      setIsSaving(true);

      await completeProfile({
        fullName,
        university,
        major,
      });

      await refreshProfile();
    } catch (error: unknown) {
      console.error("Profile setup failed:", error);

      let message = "Unable to complete your profile.";

      if (
        typeof error === "object" &&
        error !== null &&
        "message" in error &&
        typeof error.message === "string"
      ) {
        message = error.message;
      }

      Alert.alert("Profile setup failed", message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <SafeAreaView
      style={[
        styles.safeArea,
        { backgroundColor: colors.background },
      ]}
    >
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={
          Platform.OS === "ios" ? "padding" : undefined
        }
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.heading}>
            <Text
              style={[
                styles.title,
                {
                  color: colors.text,
                  fontFamily: Fonts.sans,
                },
              ]}
            >
              Complete Your Profile
            </Text>

            <Text
              style={[
                styles.subtitle,
                {
                  color: colors.icon,
                  fontFamily: Fonts.sans,
                },
              ]}
            >
              Tell us a little about yourself before you
              start rolling.
            </Text>
          </View>

          <ProfileAvatar editable />

          <View style={styles.form}>
            <TextInput
              label="Full Name"
              value={fullName}
              onChangeText={setFullName}
              mode="outlined"
              autoCapitalize="words"
              disabled={isSaving}
              outlineColor={colors.outlineVariant}
              activeOutlineColor={colors.tint}
              textColor={colors.text}
              style={[
                styles.input,
                {
                  backgroundColor:
                    colors.surfaceContainerHigh,
                },
              ]}
            />

            <TextInput
              label="University"
              value={university}
              onChangeText={setUniversity}
              mode="outlined"
              autoCapitalize="words"
              disabled={isSaving}
              outlineColor={colors.outlineVariant}
              activeOutlineColor={colors.tint}
              textColor={colors.text}
              style={[
                styles.input,
                {
                  backgroundColor:
                    colors.surfaceContainerHigh,
                },
              ]}
            />

            <TextInput
              label="Major"
              value={major}
              onChangeText={setMajor}
              mode="outlined"
              autoCapitalize="words"
              disabled={isSaving}
              outlineColor={colors.outlineVariant}
              activeOutlineColor={colors.tint}
              textColor={colors.text}
              style={[
                styles.input,
                {
                  backgroundColor:
                    colors.surfaceContainerHigh,
                },
              ]}
            />
          </View>

          <Button
            mode="contained"
            onPress={handleFinish}
            loading={isSaving}
            disabled={isSaving}
            buttonColor={colors.tint}
            textColor={colors.onPrimary}
            contentStyle={styles.finishButtonContent}
            style={styles.finishButton}
            labelStyle={styles.finishButtonLabel}
          >
            Finish Setup
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },

  keyboardView: {
    flex: 1,
  },

  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 40,
    gap: 24,
  },

  heading: {
    alignItems: "center",
    gap: 8,
  },

  title: {
    fontSize: 28,
    fontWeight: "700",
    textAlign: "center",
  },

  subtitle: {
    maxWidth: 320,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },

  form: {
    gap: 16,
  },

  input: {
    fontFamily: Fonts.sans,
  },

  finishButton: {
    borderRadius: 14,
    marginTop: "auto",
  },

  finishButtonContent: {
    height: 54,
  },

  finishButtonLabel: {
    fontSize: 16,
    fontWeight: "700",
  },
});