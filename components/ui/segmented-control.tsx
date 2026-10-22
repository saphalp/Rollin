import { Colors, Fonts } from "@/constants/theme";
import { Pressable, StyleSheet, useColorScheme, View } from "react-native";
import { Text } from "react-native-paper";

type SegmentedControlProps<T extends string> = {
  options: { label: string; value: T }[];
  value: T;
  onChange: (value: T) => void;
};

export default function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) {
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
      {options.map((option) => {
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
