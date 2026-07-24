import UserProfile from "@/components/profile/UserProfile";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { AppView } from "@/components/view";
import { Colors } from "@/constants/theme";
import { router, useLocalSearchParams } from "expo-router";
import { Pressable, StyleSheet, useColorScheme, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function ProfileByIdScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const theme = useColorScheme() ?? "light";
  const colors = Colors[theme];

  return (
    <AppView style={styles.container}>
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 8,
            backgroundColor: colors.background,
          },
        ]}
      >
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={({ pressed }) => [
            styles.backButton,
            { opacity: pressed ? 0.6 : 1 },
          ]}
        >
          <IconSymbol name="chevron.left" size={26} color={colors.text} />
        </Pressable>
      </View>
      <UserProfile userId={id ?? ""} />
    </AppView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  backButton: {
    padding: 4,
  },
});
