import { Image } from "expo-image";
import { StyleSheet, TouchableOpacity, View } from "react-native";

import { AppText } from "@/components/text";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors, Fonts } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

export type StandaloneRideCardProps = {
  driverName: string;
  driverAvatarUri: string;
  pickupLocation: string;
  destination: string;
  dateLabel?: string;
  availableSeats: number;
  onPress?: () => void;
};

export function StandaloneRideCard({
  driverName,
  driverAvatarUri,
  pickupLocation,
  destination,
  dateLabel,
  availableSeats,
  onPress,
}: StandaloneRideCardProps) {
  const theme = useColorScheme() ?? "light";
  const colors = Colors[theme];

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.outlineVariant }]}
    >
      <View style={styles.driverRow}>
        <Image source={{ uri: driverAvatarUri }} style={styles.avatar} contentFit="cover" />
        <AppText
          numberOfLines={1}
          style={[styles.driverName, { color: colors.text, fontFamily: Fonts?.sans }]}
        >
          {driverName}
        </AppText>
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
          <IconSymbol name="mappin" size={12} color={colors.tint} />
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
          <IconSymbol name="calendar" size={12} color={colors.icon} />
          <AppText
            numberOfLines={1}
            style={[styles.metaText, { color: colors.icon, fontFamily: Fonts?.sans }]}
          >
            {dateLabel ?? "Flexible"}
          </AppText>
        </View>

        <View style={[styles.seatsBadge, { backgroundColor: colors.secondaryContainer }]}>
          <IconSymbol name="person.2.fill" size={11} color={colors.onSecondaryContainer} />
          <AppText style={[styles.seatsText, { color: colors.onSecondaryContainer, fontFamily: Fonts?.sans }]}>
            {availableSeats}
          </AppText>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const CARD_WIDTH = 200;

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  driverRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  avatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
  },
  driverName: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
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
    height: 10,
    marginLeft: 6,
  },
  routeText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 2,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flexShrink: 1,
  },
  metaText: {
    fontSize: 11,
    flexShrink: 1,
  },
  seatsBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  seatsText: {
    fontSize: 11,
    fontWeight: "700",
  },
});
