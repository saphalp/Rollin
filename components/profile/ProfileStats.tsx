import { Colors } from "@/constants/theme";
import { StyleSheet, useColorScheme, View } from "react-native";
import StatsCard from "./StatsCard";

interface StatsData {
  attended: number;
  hosted: number;
  rides: number;
  reviews: number | null;
}

interface ProfileStatsProps {
  statsData: StatsData;
  onReviewsPress?: () => void;
}

export default function ProfileStats({ statsData, onReviewsPress }: ProfileStatsProps) {
  const theme = useColorScheme() ?? "light";
  const colors = Colors[theme];

  const entries = Object.entries(statsData) as [keyof StatsData, number | null][];

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          borderColor: colors.outlineVariant,
        },
      ]}
    >
      {entries.map(([key, value], index) => (
        <View key={key} style={styles.item}>
          <StatsCard
            label={key}
            score={key === "reviews" ? (value == null ? '—' : value.toFixed(1)) : (value ?? 0)}
            onPress={key === "reviews" ? onReviewsPress : undefined}
          />
          {index < entries.length - 1 && (
            <View
              style={[
                styles.divider,
                { backgroundColor: colors.outlineVariant },
              ]}
            />
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    borderRadius: 15,
    paddingVertical: 16,
  },
  item: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: "stretch",
    marginVertical: 4,
  },
});
