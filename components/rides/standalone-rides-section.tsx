import { router } from "expo-router";
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from "react-native";

import { StandaloneRideCard } from "@/components/rides/standalone-ride-card";
import { AppText } from "@/components/text";
import { Colors, Fonts } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useStandaloneRides } from "@/hooks/use-standalone-rides";

export function StandaloneRidesSection() {
  const theme = useColorScheme() ?? "light";
  const colors = Colors[theme];
  const { rides, loading } = useStandaloneRides();

  if (!loading && rides.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <AppText style={[styles.heading, { color: colors.text, fontFamily: Fonts?.sans }]}>
          Rides Offered
        </AppText>

        <TouchableOpacity onPress={() => router.push("/(tabs)/rides")} hitSlop={8}>
          <AppText style={[styles.seeAll, { color: colors.tint, fontFamily: Fonts?.sans }]}>
            See all
          </AppText>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.tint} style={styles.loader} />
      ) : (
        <View style={styles.list}>
          {rides.map((ride) => (
            <StandaloneRideCard
              key={ride.id}
              driverName={ride.driverName}
              driverAvatarUri={ride.driverAvatarUri}
              pickupLocation={ride.pickupLocation}
              destination={ride.destination}
              dateLabel={ride.dateLabel}
              availableSeats={ride.availableSeats}
              onPress={() =>
                router.push({
                  pathname: "/ride/[id]",
                  params: { id: ride.id },
                })
              }
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heading: {
    fontSize: 18,
    fontWeight: "700",
  },
  seeAll: {
    fontSize: 14,
    fontWeight: "600",
  },
  list: {
    gap: 12,
  },
  loader: {
    marginVertical: 12,
    alignSelf: "flex-start",
  },
});
