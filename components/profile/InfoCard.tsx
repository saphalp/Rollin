import { AppText } from "@/components/text";
import { IconSymbol, IconSymbolName } from "@/components/ui/icon-symbol";
import { Colors, Fonts } from "@/constants/theme";
import { StyleSheet, View } from "react-native";

type InfoCardProps = {
  icon: IconSymbolName;
  title?: string;
  text: string;
  accent?: "primary" | "secondary";
};

export default function InfoCard({ icon, title, text, accent = "primary" }: InfoCardProps) {
  const colors = Colors.light;

  const iconBackground = accent === "secondary" ? colors.secondaryContainer : colors.primaryContainer;
  const iconColor = accent === "secondary" ? colors.onSecondaryContainer : colors.onPrimary;

  return (
    <View style={[styles.card, { backgroundColor: colors.surfaceContainer }]}>
      <View style={[styles.iconCircle, { backgroundColor: iconBackground }]}>
        <IconSymbol name={icon} size={16} color={iconColor} />
      </View>

      <View style={styles.textColumn}>
        {title && (
          <AppText style={[styles.title, { color: colors.text, fontFamily: Fonts.sans }]}>
            {title}
          </AppText>
        )}
        <AppText style={[styles.text, { color: colors.icon, fontFamily: Fonts.sans }]}>
          {text}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderRadius: 16,
    padding: 14,
  },

  iconCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },

  textColumn: {
    flex: 1,
    gap: 2,
  },

  title: {
    fontSize: 14,
    fontWeight: "700",
  },

  text: {
    fontSize: 13,
    lineHeight: 19,
  },
});
