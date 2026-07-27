import UserProfile from "@/components/profile/UserProfile";
import { AppView } from "@/components/view";
import { Colors } from "@/constants/theme";
import { useAuthContext } from "@/hooks/use-auth-context";
import {
  ActivityIndicator,
  StyleSheet,
  useColorScheme,
  View,
} from "react-native";

export default function ProfileScreen() {
  const { claims, isLoading } = useAuthContext();
  const theme = useColorScheme() ?? "light";
  const colors = Colors[theme];
  const userId = claims?.sub as string | undefined;

  return (
    <AppView style={styles.container}>
      {isLoading || !userId ? (
        <View style={styles.loader}>
          <ActivityIndicator color={colors.tint} />
        </View>
      ) : (
        <UserProfile userId={userId} />
      )}
    </AppView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loader: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
