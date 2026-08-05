import { Colors, Fonts } from "@/constants/theme";
import { Pressable, StyleSheet, useColorScheme, View } from "react-native";
import { Text } from "react-native-paper";

export type ActivityView = "created" | "joined";

type ActivitySegmentedControlProps = {
  value: ActivityView;
  onChange: (value: ActivityView) => void;
};

const OPTIONS: { label: string; value: ActivityView }[] = [
  { label: "Created", value: "created" },
  { label: "Joined", value: "joined" },
];

export default function ActivitySegmentedControl({
  value,
  onChange,
}: ActivitySegmentedControlProps) {
  const theme = useColorScheme() ?? "light";
  const colors = Colors[theme];

  return (
    <View
      accessibilityRole="tablist"
      style={[
        styles.container,
        {
          backgroundColor: colors.surfaceContainerHigh,
          borderColor: colors.outlineVariant,
        },
      ]}
    >
      {OPTIONS.map((option) => {
        const selected = value === option.value;

        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.option,
              selected && { backgroundColor: colors.tint },
              pressed && styles.pressed,
            ]}
          >
            <Text
              style={[
                styles.label,
                {
                  color: selected ? colors.onPrimary : colors.text,
                  fontFamily: Fonts.sans,
                },
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    borderWidth: 1,
    borderRadius: 14,
    padding: 4,
  },
  option: {
    flex: 1,
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
  },
  pressed: {
    opacity: 0.85,
  },
  label: {
    fontSize: 14,
    fontWeight: "700",
  },
});
