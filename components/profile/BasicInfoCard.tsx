import ProfileAvatar from "@/components/profile/ProfileAvatar";
import { Colors, Fonts } from "@/constants/theme";

import { useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { Button, Text, TextInput } from "react-native-paper";

export type BasicInfoValues = {
  fullName: string;
  university: string;
  major: string;
};

type BasicInfoCardProps = BasicInfoValues & {
  onNext: (values: BasicInfoValues) => void;
  title?: string;
  subtitle?: string;
};

export default function BasicInfoCard({
  fullName: initialFullName,
  university: initialUniversity,
  major: initialMajor,
  onNext,
  title = "Complete Your Profile",
  subtitle = "Tell us a little about yourself before you start rolling.",
}: BasicInfoCardProps) {
  const colors = Colors.light;

  const [fullName, setFullName] = useState(initialFullName);
  const [university, setUniversity] = useState(initialUniversity);
  const [major, setMajor] = useState(initialMajor);

  function handleNext() {
    if (!fullName.trim()) {
      Alert.alert("Missing name", "Please enter your full name.");
      return;
    }

    if (!university.trim()) {
      Alert.alert("Missing university", "Please enter your university.");
      return;
    }

    if (!major.trim()) {
      Alert.alert("Missing major", "Please enter your major.");
      return;
    }

    onNext({ fullName, university, major });
  }

  return (
    <View style={styles.container}>
      <View style={styles.heading}>
        <Text
          style={[styles.title, { color: colors.text, fontFamily: Fonts.sans }]}
        >
          {title}
        </Text>

        <Text
          style={[
            styles.subtitle,
            { color: colors.icon, fontFamily: Fonts.sans },
          ]}
        >
          {subtitle}
        </Text>
      </View>

      <ProfileAvatar editable />

      <View style={styles.form}>
        <TextInput
          label="Full Name"
          value={fullName}
          onChangeText={setFullName}
          mode="outlined"
          autoCapitalize="words"
          outlineColor={colors.outlineVariant}
          activeOutlineColor={colors.tint}
          textColor={colors.text}
          style={[styles.input, { backgroundColor: colors.surfaceContainerHigh }]}
        />

        <TextInput
          label="University"
          value={university}
          onChangeText={setUniversity}
          mode="outlined"
          autoCapitalize="words"
          outlineColor={colors.outlineVariant}
          activeOutlineColor={colors.tint}
          textColor={colors.text}
          style={[styles.input, { backgroundColor: colors.surfaceContainerHigh }]}
        />

        <TextInput
          label="Major"
          value={major}
          onChangeText={setMajor}
          mode="outlined"
          autoCapitalize="words"
          outlineColor={colors.outlineVariant}
          activeOutlineColor={colors.tint}
          textColor={colors.text}
          style={[styles.input, { backgroundColor: colors.surfaceContainerHigh }]}
        />
      </View>

      <Button
        mode="contained"
        onPress={handleNext}
        buttonColor={colors.tint}
        textColor={colors.onPrimary}
        contentStyle={styles.nextButtonContent}
        style={styles.nextButton}
        labelStyle={styles.nextButtonLabel}
      >
        Next
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 24,
  },

  heading: {
    alignItems: "center",
    gap: 8,
  },

  title: {
    fontSize: 28,
    fontWeight: "700",
    textAlign: "center",
  },

  subtitle: {
    maxWidth: 320,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },

  form: {
    gap: 16,
  },

  input: {
    fontFamily: Fonts.sans,
  },

  nextButton: {
    borderRadius: 14,
    marginTop: "auto",
  },

  nextButtonContent: {
    height: 54,
  },

  nextButtonLabel: {
    fontSize: 16,
    fontWeight: "700",
  },
});
