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
          Rides
        </AppText>

        <AppText
          style={[
            styles.subtitle,
            { color: colors.icon, fontFamily: Fonts?.sans },
          ]}
        >
          Share the trip, split the drive.
        </AppText>
      </View>

      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="How ride sharing works"
        onPress={onHelpPress}
        style={[
          styles.helpButton,
          {
            backgroundColor: colors.cardBackground,
            borderColor: colors.outlineVariant,
          },
        ]}
      >
        <MaterialCommunityIcons
          name="lightbulb-on-outline"
          size={18}
          color={colors.tint}
        />
        <AppText
          style={[
            styles.helpText,
            { color: colors.tint, fontFamily: Fonts?.sans },
          ]}
        >
          How it works
        </AppText>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "700",
  },
  subtitle: {
    marginTop: 2,
    fontSize: 14,
    lineHeight: 20,
  },
  helpButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 40,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
  },
  helpText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
  },
});
