import { MaterialCommunityIcons } from "@expo/vector-icons";
import { StyleSheet, TouchableOpacity, View } from "react-native";

import { AppText } from "@/components/text";
import { Colors, Fonts } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

type RideHeaderProps = {
  onHelpPress: () => void;
};

export function RideHeader({ onHelpPress }: RideHeaderProps) {
  const theme = useColorScheme() ?? "light";
  const colors = Colors[theme];

  return (
    <View style={styles.header}>
      <View style={styles.headerText}>
        <AppText
          style={[
            styles.title,
            { color: colors.text, fontFamily: Fonts?.sans },
          ]}
        >
          Ride Sharing
        </AppText>

        <AppText
          style={[
            styles.subtitle,
            { color: colors.icon, fontFamily: Fonts?.sans },
          ]}
        >
          Find a trip, share seats, and manage your rides.
        </AppText>
      </View>

      <TouchableOpacity
        accessibilityRole="button"
        onPress={onHelpPress}
        style={[
          styles.helpButton,
          { backgroundColor: colors.primaryContainer },
        ]}
      >
        <MaterialCommunityIcons
          name="help"
          size={22}
          color={colors.onPrimary}
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
  },
  subtitle: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 20,
  },
  helpButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
});
