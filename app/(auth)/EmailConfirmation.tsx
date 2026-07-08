import { Colors } from "@/constants/theme";
import { StyleSheet, Text, View } from "react-native";
import Svg2, { Path, Rect } from "react-native-svg";

export default function EmailVerificationScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Svg2 width={90} height={70} viewBox="0 0 90 70" style={styles.icon}>
          <Rect x="2" y="8" width="86" height="56" rx="8" fill="#ffffff" />
          <Path
            d="M8 16 L45 42 L82 16"
            stroke={Colors.light.primaryContainer}
            strokeWidth={5}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg2>

        <Text style={styles.title}>Check your inbox</Text>
        <Text style={styles.body}>
          We've sent a verification link to your email address. Click the link
          to activate your account and start rolling.
        </Text>
      </View>

      <Text style={styles.resendText}>
        Didn't get the email? <Text style={styles.resendLink}>Resend link</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#3b63d6",
    paddingTop: 48,
    paddingHorizontal: 24,
    alignItems: "center",
    overflow: "hidden",
  },
  card: {
    backgroundColor: "rgba(255,255,255,0.14)",
    borderRadius: 16,
    paddingVertical: 40,
    paddingHorizontal: 24,
    width: "100%",
    maxWidth: 320,
    alignItems: "center",
  },
  icon: {
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: "500",
    color: "#ffffff",
    marginBottom: 12,
    textAlign: "center",
  },
  body: {
    fontSize: 14,
    lineHeight: 22,
    color: "rgba(255,255,255,0.85)",
    textAlign: "center",
  },
  resendText: {
    fontSize: 13,
    color: "rgba(255,255,255,0.85)",
    marginTop: 20,
    marginBottom: 32,
    textAlign: "center",
  },
  resendLink: {
    fontWeight: "500",
    color: "#ffffff",
  },
  wave: {
    position: "absolute",
    bottom: 0,
    left: 0,
    width: "100%",
    height: 60,
  },
});
