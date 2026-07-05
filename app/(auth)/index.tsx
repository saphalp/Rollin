import AuthHeader from "@/components/auth/AuthHeader";
import ImageContainer from "@/components/auth/ImageContainer";
import { KeyboardAvoidingView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function LoginScreen() {
  return (
    <SafeAreaView>
      <KeyboardAvoidingView>
        <View style={styles.container}>
          <AuthHeader />
          <ImageContainer />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container : {
    paddingHorizontal: 20
  }
})
