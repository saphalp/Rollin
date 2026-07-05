import AuthHeader from "@/components/auth/AuthHeader";
import EmailCard from "@/components/auth/EmailCard";
import ImageContainer from "@/components/auth/ImageContainer";
import TermsFooter from "@/components/auth/TermsFooter";
import { KeyboardAvoidingView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function LoginScreen() {
  return (
    <SafeAreaView>
      <KeyboardAvoidingView>
        <View style={styles.container}>
          <AuthHeader />
          <ImageContainer />
          <EmailCard />
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
