import { router } from "expo-router";
import { useState } from "react";
import {
    Alert,
    Pressable,
    ScrollView,
    StyleSheet,
    Switch,
    TextInput,
    useColorScheme,
    View,
} from "react-native";

import { AppText } from "@/components/text";
import { Colors } from "@/constants/theme";

const interestsList = [
  "Sports",
  "Music",
  "Food",
  "Movies",
  "Gaming",
  "Volunteering",
  "Study Groups",
  "Outdoor Activities",
  "Campus Events",
  "Fitness",
];

export default function CompleteProfileScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];

  const [fullName, setFullName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [university, setUniversity] = useState("");
  const [major, setMajor] = useState("");

  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [isDriver, setIsDriver] = useState(false);

  const [vehicleMake, setVehicleMake] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [vehicleYear, setVehicleYear] = useState("");

  const styles = getStyles(theme);

  const toggleInterest = (interest: string) => {
    if (selectedInterests.includes(interest)) {
      setSelectedInterests(
        selectedInterests.filter((item) => item !== interest)
      );
    } else {
      setSelectedInterests([...selectedInterests, interest]);
    }
  };

  const handleNext = () => {
    if (!fullName || !dateOfBirth || !university || !major) {
      Alert.alert(
        "Missing Information",
        "Please complete your basic information before continuing."
      );
      return;
    }

    Alert.alert("Basic Info Saved", "Now choose your interests.");
  };

  const handleFinish = () => {
    if (!fullName || !dateOfBirth || !university || !major) {
      Alert.alert(
        "Missing Information",
        "Please fill out full name, date of birth, university, and major."
      );
      return;
    }

    if (selectedInterests.length < 3) {
      Alert.alert("Choose Interests", "Please select at least 3 interests.");
      return;
    }

    if (isDriver && (!vehicleMake || !vehicleModel || !vehicleYear)) {
      Alert.alert(
        "Vehicle Information",
        "Please complete vehicle make, model, and year."
      );
      return;
    }

    const profileData = {
      fullName,
      dateOfBirth,
      university,
      major,
      interests: selectedInterests,
      driver: isDriver
        ? {
            vehicleMake,
            vehicleModel,
            vehicleYear,
          }
        : null,
    };

    console.log("Profile submitted:", profileData);

    Alert.alert("Profile Complete", "Your profile has been saved.");
    router.replace("/(tabs)");
  };

  const handleSkip = () => {
    router.replace("/(tabs)");
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <AppText style={styles.logo}>Rollin’</AppText>

      <View style={styles.progressWrapper}>
        <View style={styles.progressBar} />
      </View>

      <AppText style={styles.title}>Complete Your Profile</AppText>

      <AppText style={styles.subtitle}>
        Add your basic information, interests, and optional driver details.
      </AppText>

      <Pressable
        style={styles.photoBox}
        onPress={() =>
          Alert.alert("Profile Photo", "Profile photo upload will be added here.")
        }
      >
        <AppText style={styles.photoText}>Upload Profile Photo</AppText>
      </Pressable>

      <AppText style={styles.sectionTitle}>Basic Information</AppText>

      <TextInput
        style={styles.input}
        placeholder="Full Name"
        placeholderTextColor={theme.outline}
        value={fullName}
        onChangeText={setFullName}
      />

      <TextInput
        style={styles.input}
        placeholder="Date of Birth"
        placeholderTextColor={theme.outline}
        value={dateOfBirth}
        onChangeText={setDateOfBirth}
      />

      <TextInput
        style={styles.input}
        placeholder="University"
        placeholderTextColor={theme.outline}
        value={university}
        onChangeText={setUniversity}
      />

      <TextInput
        style={styles.input}
        placeholder="Major"
        placeholderTextColor={theme.outline}
        value={major}
        onChangeText={setMajor}
      />

      <AppText style={styles.sectionTitle}>Interests / Hobbies</AppText>
      <AppText style={styles.helperText}>Select at least 3 interests.</AppText>

      <View style={styles.chipContainer}>
        {interestsList.map((interest) => {
          const selected = selectedInterests.includes(interest);

          return (
            <Pressable
              key={interest}
              style={[styles.chip, selected && styles.selectedChip]}
              onPress={() => toggleInterest(interest)}
            >
              <AppText
                style={[styles.chipText, selected && styles.selectedChipText]}
              >
                {interest}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.driverRow}>
        <View style={styles.driverTextBox}>
          <AppText style={styles.sectionTitle}>Register as Driver</AppText>
          <AppText style={styles.helperText}>
            Optional: Offer rides to activities.
          </AppText>
        </View>

        <Switch value={isDriver} onValueChange={setIsDriver} />
      </View>

      {isDriver && (
        <View>
          <TextInput
            style={styles.input}
            placeholder="Vehicle Make"
            placeholderTextColor={theme.outline}
            value={vehicleMake}
            onChangeText={setVehicleMake}
          />

          <TextInput
            style={styles.input}
            placeholder="Vehicle Model"
            placeholderTextColor={theme.outline}
            value={vehicleModel}
            onChangeText={setVehicleModel}
          />

          <TextInput
            style={styles.input}
            placeholder="Vehicle Year"
            placeholderTextColor={theme.outline}
            value={vehicleYear}
            onChangeText={setVehicleYear}
            keyboardType="number-pad"
          />
        </View>
      )}

      <View style={styles.buttonRow}>
        <Pressable style={styles.secondaryButton} onPress={handleSkip}>
          <AppText style={styles.secondaryButtonText}>Skip</AppText>
        </Pressable>

        <Pressable style={styles.secondaryButton} onPress={handleNext}>
          <AppText style={styles.secondaryButtonText}>Next</AppText>
        </Pressable>

        <Pressable style={styles.primaryButton} onPress={handleFinish}>
          <AppText style={styles.primaryButtonText}>Finish</AppText>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function getStyles(theme: typeof Colors.light) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    content: {
      padding: 24,
      paddingBottom: 50,
    },
    logo: {
      fontSize: 34,
      fontWeight: "800",
      color: theme.tint,
      textAlign: "center",
      marginBottom: 16,
    },
    progressWrapper: {
      height: 8,
      backgroundColor: theme.surfaceContainer,
      borderRadius: 20,
      marginBottom: 28,
    },
    progressBar: {
      height: 8,
      width: "70%",
      backgroundColor: theme.secondaryContainer,
      borderRadius: 20,
    },
    title: {
      fontSize: 26,
      fontWeight: "700",
      color: theme.text,
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 15,
      color: theme.icon,
      marginBottom: 24,
      lineHeight: 22,
    },
    photoBox: {
      height: 120,
      borderWidth: 1,
      borderStyle: "dashed",
      borderColor: theme.tint,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.surfaceContainer,
      marginBottom: 24,
    },
    photoText: {
      color: theme.tint,
      fontWeight: "700",
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.text,
      marginBottom: 8,
    },
    helperText: {
      fontSize: 14,
      color: theme.icon,
      marginBottom: 12,
    },
    input: {
      borderWidth: 1,
      borderColor: theme.outlineVariant,
      borderRadius: 12,
      padding: 14,
      fontSize: 16,
      marginBottom: 14,
      backgroundColor: theme.cardBackground,
      color: theme.text,
    },
    chipContainer: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
      marginBottom: 24,
    },
    chip: {
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.outlineVariant,
      backgroundColor: theme.cardBackground,
    },
    selectedChip: {
      backgroundColor: theme.tint,
      borderColor: theme.tint,
    },
    chipText: {
      color: theme.text,
      fontWeight: "600",
    },
    selectedChipText: {
      color: theme.onPrimary,
    },
    driverRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 14,
    },
    driverTextBox: {
      flex: 1,
      paddingRight: 12,
    },
    buttonRow: {
      flexDirection: "row",
      gap: 10,
      marginTop: 24,
    },
    primaryButton: {
      flex: 1,
      backgroundColor: theme.tint,
      padding: 15,
      borderRadius: 14,
      alignItems: "center",
    },
    primaryButtonText: {
      color: theme.onPrimary,
      fontWeight: "700",
      fontSize: 16,
    },
    secondaryButton: {
      flex: 1,
      backgroundColor: theme.surfaceContainerHigh,
      padding: 15,
      borderRadius: 14,
      alignItems: "center",
    },
    secondaryButtonText: {
      color: theme.text,
      fontWeight: "700",
      fontSize: 16,
    },
  });
}