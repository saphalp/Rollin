import { IconSymbol, type IconSymbolName } from "@/components/ui/icon-symbol";
import { Colors, Fonts } from "@/constants/theme";
import { StyleSheet, useColorScheme, View } from "react-native";
import { Text } from "react-native-paper";

interface ProfileInfoProps {
  name: string;
  university: string;
  major: string;
  isEduVerified?: boolean;
  isVerifiedDriver?: boolean;
}

export default function ProfileInfo({
  name,
  university,
  major,
  isEduVerified = false,
  isVerifiedDriver = false,
}: ProfileInfoProps) {
  const scheme = useColorScheme() ?? "light";
  const colors = Colors[scheme];

  return (
    <View style={styles.container}>
      <Text
        numberOfLines={1}
        style={[styles.name, { color: colors.text, fontFamily: Fonts.sans }]}
      >
        {name}
      </Text>

      <View style={styles.metaRow}>
        <Text
          numberOfLines={1}
          style={[styles.meta, { color: colors.text, fontFamily: Fonts.sans }]}
        >
          {university}
        </Text>
        <View style={[styles.dot, { backgroundColor: colors.icon }]} />
        <Text
          numberOfLines={1}
          style={[styles.meta, { color: colors.icon, fontFamily: Fonts.sans }]}
        >
          {major}
        </Text>
      </View>

      {(isEduVerified || isVerifiedDriver) && (
        <View style={styles.badgeRow}>
          {isEduVerified && (
            <VerificationBadge icon="checkmark.seal.fill" label=".edu Verified" />
          )}
          {isVerifiedDriver && (
            <VerificationBadge icon="car.fill" label="Verified Driver" />
          )}
        </View>
      )}
    </View>
  );
}

function VerificationBadge({ icon, label }: { icon: IconSymbolName; label: string }) {
  const scheme = useColorScheme() ?? "light";
  const colors = Colors[scheme];

  return (
    <View
      accessible
      accessibilityLabel={label}
      style={[styles.badge, { backgroundColor: colors.verifiedContainer }]}
    >
      <IconSymbol name={icon} size={14} color={colors.onVerifiedContainer} />
      <Text style={[styles.badgeText, { color: colors.onVerifiedContainer, fontFamily: Fonts.sans }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
  },
  name: {
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  meta: {
    fontSize: 14,
    fontWeight: "500",
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    opacity: 0.6,
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
    marginTop: 4,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
  },
});
