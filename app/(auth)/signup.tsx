import {router} from "expo-router";
import AuthHeader from "@/components/auth/AuthHeader";
import EmailCard from "@/components/auth/EmailCard";
import ImageContainer from "@/components/auth/ImageContainer";
import Login from "@/components/auth/login";
import PasswordCard from "@/components/auth/PasswordCard";
import TermsFooter from "@/components/auth/TermsFooter";
import { useState } from "react";
import { KeyboardAvoidingView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function LoginScreen() {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  return (
    <SafeAreaView>
      <KeyboardAvoidingView>
        <View style={styles.container}>
          <AuthHeader />
          <ImageContainer />
          {step === 1 && (
            <EmailCard
              email={email}
              onNext={(value: string) => {
                setEmail(value);
                setStep(2);
              }}
              onLoginClick={() => setStep(0)}
            />
          )}
          {step == 2 && (
            <PasswordCard
              email={email}
              onLoginClick={() => setStep(0)}
              onSignUpSuccess={() => router.replace("/complete-profile")}
            />
          )} onLoginClick={() => setStep(0)} />}
          {step == 0 && <Login onSignUpClick={() => setStep(1)} />}
          <TermsFooter />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
  },
});
