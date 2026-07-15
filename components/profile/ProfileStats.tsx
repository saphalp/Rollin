import { View } from "react-native";

interface statsData {
  attended: Number;
  hosted: Number;
  rides: Number;
  rating: Number;
}

interface StatsDataProp {
  statsData: statsData;
}

export default function ProfileStats(statsData: StatsDataProp) {
  return <View>Stats Card</View>;
}
