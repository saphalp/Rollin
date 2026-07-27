import { Colors, Fonts } from "@/constants/theme";
import { useEffect, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  useColorScheme,
  View,
} from "react-native";
import { Button, Chip, IconButton, Text } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface InterestPickerSheetProps {
  visible: boolean;
  onClose: () => void;
  onSave: (selected: string[]) => void;
  currentInterests: string[];
  options: string[];
}

export default function InterestPickerSheet({
  visible,
  onClose,
  onSave,
  currentInterests,
  options,
}: InterestPickerSheetProps) {
  const theme = useColorScheme() ?? "light";
  const colors = Colors[theme];
  const insets = useSafeAreaInsets();

  const [selected, setSelected] = useState<string[]>(currentInterests);

  useEffect(() => {
    if (visible) setSelected(currentInterests);
  }, [visible, currentInterests]);

  const allOptions = useMemo(() => {
    const set = new Set<string>([...options, ...currentInterests]);
    return Array.from(set);
  }, [options, currentInterests]);

  function toggle(interest: string) {
    setSelected((prev) =>
      prev.includes(interest)
        ? prev.filter((i) => i !== interest)
        : [...prev, interest],
    );
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.container}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface,
              paddingBottom: insets.bottom + 16,
            },
          ]}
        >
          <View
            style={[styles.handle, { backgroundColor: colors.outlineVariant }]}
          />

          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text
                style={[
                  styles.title,
                  { color: colors.text, fontFamily: Fonts.sans },
                ]}
              >
                Your interests
              </Text>
              <Text
                style={[
                  styles.subtitle,
                  { color: colors.icon, fontFamily: Fonts.sans },
                ]}
              >
                Pick what describes you. You can change these later.
              </Text>
            </View>
            <IconButton
              icon="close"
              size={20}
              onPress={onClose}
              iconColor={colors.icon}
              style={styles.closeButton}
            />
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.chipsGrid}
            showsVerticalScrollIndicator={false}
          >
            {allOptions.map((opt) => {
              const isSelected = selected.includes(opt);
              return (
                <Chip
                  key={opt}
                  onPress={() => toggle(opt)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: isSelected
                        ? colors.tint
                        : colors.surfaceContainerHigh,
                      borderColor: isSelected
                        ? colors.tint
                        : colors.outlineVariant,
                    },
                  ]}
                  textStyle={{
                    color: isSelected ? colors.onPrimary : colors.text,
                    fontFamily: Fonts.sans,
                    fontWeight: "500",
                  }}
                >
                  {opt}
                </Chip>
              );
            })}
          </ScrollView>

          <Button
            mode="contained"
            onPress={() => onSave(selected)}
            buttonColor={colors.tint}
            textColor={colors.onPrimary}
            style={styles.saveButton}
            contentStyle={styles.saveButtonContent}
            labelStyle={styles.saveButtonLabel}
          >
            {selected.length > 0 ? `Save (${selected.length})` : "Save"}
          </Button>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 8,
    maxHeight: "85%",
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 12,
    gap: 8,
  },
  headerText: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  closeButton: {
    margin: 0,
    marginTop: -6,
    marginRight: -6,
  },
  scrollView: {
    maxHeight: 380,
  },
  chipsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingBottom: 20,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
  },
  saveButton: {
    borderRadius: 14,
    marginTop: 4,
  },
  saveButtonContent: {
    height: 52,
  },
  saveButtonLabel: {
    fontSize: 16,
    fontWeight: "700",
  },
});
