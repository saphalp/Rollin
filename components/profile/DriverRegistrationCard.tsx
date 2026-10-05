import DriverVehicleFields from "@/components/profile/DriverVehicleFields";
import { Colors, Fonts } from "@/constants/theme";
import { validateDriverFields } from "@/lib/profile/validate-driver-fields";

import { useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { Button, Text } from "react-native-paper";

export type DriverRegistrationValues = {
  vehicleMake: string;
  vehicleModel: string;
  vehicleColor: string;
  licensePlateNumber: string;
};

type DriverRegistrationCardProps = {
  isSaving: boolean;
  onBack: () => void;
  onSkip: () => void;
  onRegister: (values: DriverRegistrationValues) => void;
};

export default function DriverRegistrationCard({
  isSaving,
  onBack,
  onSkip,
  onRegister,
}: DriverRegistrationCardProps) {
  const colors = Colors.light;

  const [vehicleMake, setVehicleMake] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [vehicleColor, setVehicleColor] = useState("");
  const [licensePlateNumber, setLicensePlateNumber] = useState("");

  function handleRegister() {
    const values = { vehicleMake, vehicleModel, vehicleColor, licensePlateNumber };

    const error = validateDriverFields(values);

    if (error) {
      Alert.alert("Missing info", error);
      return;
    }

    onRegister(values);
  }

  return (
    <View style={styles.container}>
      <View style={styles.heading}>
        <Text
          style={[styles.title, { color: colors.text, fontFamily: Fonts.sans }]}
        >
          Register as a Driver
        </Text>

        <Text
          style={[
            styles.subtitle,
            { color: colors.icon, fontFamily: Fonts.sans },
          ]}
        >
          Optional. Add your vehicle so you can offer rides. We&rsquo;ll
          verify your license later — for now just add your vehicle info.
        </Text>
      </View>

      <DriverVehicleFields
        vehicleMake={vehicleMake}
        vehicleModel={vehicleModel}
        vehicleColor={vehicleColor}
        licensePlateNumber={licensePlateNumber}
        onChangeVehicleMake={setVehicleMake}
        onChangeVehicleModel={setVehicleModel}
        onChangeVehicleColor={setVehicleColor}
        onChangeLicensePlateNumber={setLicensePlateNumber}
        disabled={isSaving}
      />

      <Button onPress={onBack} disabled={isSaving} textColor={colors.icon}>
        Back
      </Button>

      <View style={styles.buttonRow}>
        <Button
          mode="outlined"
          onPress={onSkip}
          disabled={isSaving}
          style={styles.button}
          contentStyle={styles.buttonContent}
        >
          Skip
        </Button>

        <Button
          mode="contained"
          onPress={handleRegister}
          loading={isSaving}
          disabled={isSaving}
          buttonColor={colors.tint}
          textColor={colors.onPrimary}
          style={styles.button}
          contentStyle={styles.buttonContent}
        >
          Register & Finish
        </Button>
      </View>
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

  buttonRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: "auto",
  },

  button: {
    flex: 1,
    borderRadius: 14,
  },

  buttonContent: {
    height: 54,
  },
});
