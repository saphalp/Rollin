import { router } from "expo-router";
import { StyleSheet, TouchableOpacity, View } from "react-native";

import { AppText } from "@/components/text";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors, Fonts } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

export default function Header() {
  const theme = useColorScheme() ?? "light";
  const colors = Colors[theme];
  return (
    <View style={styles.header}>
      <View
        style={[styles.avatar, { backgroundColor: colors.primaryContainer }]}
      />
      <AppText
        style={[
          styles.logo,
          { color: colors.tint, fontFamily: Fonts?.rounded },
        ]}
      >
        Rollin'
      </AppText>
      <TouchableOpacity hitSlop={8} onPress={() => router.push('/(tabs)/notifications')}>
        <IconSymbol name="bell.fill" size={24} color={colors.text} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  logo: {
    fontSize: 22,
    fontWeight: "700",
  },
});
