import { Colors } from "@/constants/theme";
import { useColorScheme, View } from "react-native";
import { Text } from "react-native-paper";

export default function SectionHeader({ header }: { header: string }) {
  const theme = useColorScheme() ?? "light";
  const colors = Colors[theme];
  return (
    <View>
      <Text style={{ fontSize: 20, color: colors.text, fontWeight: 600 }}>
        {" "}
        {header}{" "}
      </Text>
    </View>
  );
}
