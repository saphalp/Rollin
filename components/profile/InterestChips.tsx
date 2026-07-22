import { Colors } from "@/constants/theme";
import { useColorScheme } from "react-native";
import { Chip } from "react-native-paper";

export default function InterestChips({ label }: { label: string }) {
  const theme = useColorScheme() ?? "light";
  const colors = Colors[theme];
  return (
    <Chip
      style={{
        borderWidth: 0.5,
        borderColor: colors.icon,
        backgroundColor: colors.surface,
      }}
    >
      {label}
    </Chip>
  );
}
