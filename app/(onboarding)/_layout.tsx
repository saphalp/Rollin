import BasicInfoCard, {
    BasicInfoValues,
} from "@/components/profile/BasicInfoCard";
import DriverRegistrationCard, {
    DriverRegistrationValues,
} from "@/components/profile/DriverRegistrationCard";
import { Colors } from "@/constants/theme";
import { useAuthContext } from "@/hooks/use-auth-context";
import { completeProfile } from "@/lib/profile/complete-profile";
import { upsertDriverProfile } from "@/lib/profile/driver-profile";

import { useState } from "react";
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function Onboarding() {
  const { profile, refreshProfile } = useAuthContext();

  const colors = Colors.light;

  const [step, setStep] = useState<1 | 2>(1);

  const [basicInfo, setBasicInfo] = useState<BasicInfoValues>({
    fullName: profile?.full_name ?? "",
    university: profile?.university ?? "",
    major: profile?.major ?? "",
  });

  const [isSaving, setIsSaving] = useState(false);

  async function finishOnboarding(
    driverValues?: DriverRegistrationValues
  ) {
    try {
      setIsSaving(true);

      if (driverValues) {
        await upsertDriverProfile(driverValues);
      }

      await completeProfile(basicInfo);

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
      style={[styles.safeArea, { backgroundColor: colors.background }]}
    >
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {step === 1 && (
            <BasicInfoCard
              {...basicInfo}
              onNext={(values) => {
                setBasicInfo(values);
                setStep(2);
              }}
            />
          )}

          {step === 2 && (
            <DriverRegistrationCard
              isSaving={isSaving}
              onBack={() => setStep(1)}
              onSkip={() => finishOnboarding()}
              onRegister={(values) => finishOnboarding(values)}
            />
          )}
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
});
