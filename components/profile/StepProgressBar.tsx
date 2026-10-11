import { AppText } from "@/components/text";
import { Colors, Fonts } from "@/constants/theme";
import { StyleSheet, View } from "react-native";

type StepProgressBarProps = {
  currentStep: number;
  totalSteps: number;
  stepLabels?: string[];
};

export default function StepProgressBar({
  currentStep,
  totalSteps,
  stepLabels,
}: StepProgressBarProps) {
  const colors = Colors.light;

  return (
    <View style={styles.container}>
      <AppText style={[styles.eyebrow, { color: colors.tint, fontFamily: Fonts.sans }]}>
        STEP {currentStep} OF {totalSteps}
      </AppText>

      <View style={styles.row}>
        {Array.from({ length: totalSteps }).map((_, index) => (
          <View
            key={index}
            style={[
              styles.segment,
              { backgroundColor: index < currentStep ? colors.tint : colors.surfaceContainer },
            ]}
          />
        ))}
      </View>

      {stepLabels && (
        <View style={styles.labelsRow}>
          {stepLabels.map((label, index) => (
            <AppText
              key={label}
              style={[
                styles.label,
                {
                  color: index < currentStep ? colors.tint : colors.outline,
                  fontWeight: index === currentStep - 1 ? "700" : "600",
                  fontFamily: Fonts.sans,
                  textAlign: index === 0 ? "left" : index === stepLabels.length - 1 ? "right" : "center",
                },
              ]}
            >
              {index + 1}. {label}
            </AppText>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },

  eyebrow: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
    textAlign: "center",
  },

  row: {
    flexDirection: "row",
    gap: 8,
  },

  segment: {
    flex: 1,
    height: 6,
    borderRadius: 3,
  },

  labelsRow: {
    flexDirection: "row",
  },

  label: {
    flex: 1,
    fontSize: 12,
  },
});
