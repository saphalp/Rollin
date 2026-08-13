import { Image } from "expo-image";
import { StyleSheet, TouchableOpacity, View } from "react-native";

import { AppText } from "@/components/text";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors, Fonts } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

export type WantedRideCardProps = {
  requesterName: string;
  requesterAvatarUri: string;
  pickupLocation: string;
  destination: string;
  dateLabel?: string;
  isOwn: boolean;
  onPress?: () => void;
  onCancel?: () => void;
  cancelling?: boolean;
};

export function WantedRideCard({
  requesterName,
  requesterAvatarUri,
  pickupLocation,
  destination,
  dateLabel,
  isOwn,
  onPress,
  onCancel,
  cancelling,
}: WantedRideCardProps) {
  const theme = useColorScheme() ?? "light";
  const colors = Colors[theme];

  return (
    <TouchableOpacity
      activeOpacity={isOwn ? 1 : 0.85}
      onPress={isOwn ? undefined : onPress}
      style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.outlineVariant }]}
    >
      <View style={styles.header}>
        <Image source={{ uri: requesterAvatarUri }} style={styles.avatar} contentFit="cover" />

        <View style={styles.headerText}>
          <AppText
            numberOfLines={1}
            style={[styles.requesterName, { color: colors.text, fontFamily: Fonts?.sans }]}
          >
            {isOwn ? "You" : requesterName}
          </AppText>
          <AppText style={[styles.requesterLabel, { color: colors.icon, fontFamily: Fonts?.sans }]}>
            {isOwn ? "Your ride request" : "Wants a ride"}
          </AppText>
        </View>

        <View style={[styles.openBadge, { backgroundColor: colors.secondaryContainer }]}>
          <IconSymbol name="person.2.fill" size={11} color={colors.onSecondaryContainer} />
          <AppText style={[styles.openBadgeText, { color: colors.onSecondaryContainer, fontFamily: Fonts?.sans }]}>
            Open request
          </AppText>
        </View>
      </View>

      <View style={styles.routeBlock}>
        <View style={styles.routeRow}>
          <View style={[styles.routeDot, { backgroundColor: colors.tint }]} />
          <AppText
            numberOfLines={1}
            style={[styles.routeText, { color: colors.text, fontFamily: Fonts?.sans }]}
          >
            {pickupLocation}
          </AppText>
        </View>

        <View style={[styles.routeLine, { backgroundColor: colors.outlineVariant }]} />

        <View style={styles.routeRow}>
          <IconSymbol name="mappin" size={13} color={colors.tint} />
          <AppText
            numberOfLines={1}
            style={[styles.routeText, { color: colors.text, fontFamily: Fonts?.sans }]}
          >
            {destination}
          </AppText>
        </View>
      </View>

      <View style={styles.footerRow}>
        <View style={styles.metaItem}>
          <IconSymbol name="calendar" size={13} color={colors.icon} />
          <AppText
            numberOfLines={1}
            style={[styles.metaText, { color: colors.icon, fontFamily: Fonts?.sans }]}
          >
            {dateLabel ?? "Flexible"}
          </AppText>
        </View>

        {isOwn ? (
          <TouchableOpacity
            onPress={onCancel}
            disabled={cancelling}
            style={[styles.cancelButton, { borderColor: colors.error }]}
          >
            <AppText style={[styles.cancelText, { color: colors.error, fontFamily: Fonts?.sans }]}>
              {cancelling ? "Cancelling..." : "Cancel request"}
            </AppText>
          </TouchableOpacity>
        ) : (
          <View style={styles.offerHint}>
            <AppText style={[styles.offerHintText, { color: colors.tint, fontFamily: Fonts?.sans }]}>
              Offer this ride
            </AppText>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    gap: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  headerText: {
    flex: 1,
  },
  requesterName: {
    fontSize: 15,
    fontWeight: "700",
  },
  requesterLabel: {
    marginTop: 1,
    fontSize: 12,
  },
  openBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  openBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  routeBlock: {
    gap: 2,
  },
  routeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  routeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 2,
  },
  routeLine: {
    width: 1,
    height: 12,
    marginLeft: 6,
  },
  routeText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flexShrink: 1,
  },
  metaText: {
    fontSize: 12,
    flexShrink: 1,
  },
  cancelButton: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  cancelText: {
    fontSize: 12,
    fontWeight: "700",
  },
  offerHint: {
    flexDirection: "row",
    alignItems: "center",
  },
  offerHintText: {
    fontSize: 12,
    fontWeight: "700",
  },
});
