import DriverVehicleFields from "@/components/profile/DriverVehicleFields";
import InfoCard from "@/components/profile/InfoCard";
import StatusPill from "@/components/profile/StatusPill";
import StepProgressBar from "@/components/profile/StepProgressBar";
import VerifiedBadge from "@/components/profile/VerifiedBadge";
import { Colors, Fonts } from "@/constants/theme";
import { getDriverProfile, upsertDriverProfile } from "@/lib/profile/driver-profile";
import { startLicenseVerification } from "@/lib/profile/driver-verification";
import { isDriverFieldsEmpty, validateDriverFields } from "@/lib/profile/validate-driver-fields";

import { useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { Button, Text } from "react-native-paper";

export type DriverRegistrationValues = {
  vehicleMake: string;
  vehicleModel: string;
  vehicleYear: string;
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
  const [vehicleYear, setVehicleYear] = useState("");
  const [vehicleColor, setVehicleColor] = useState("");
  const [licensePlateNumber, setLicensePlateNumber] = useState("");

  const [verifying, setVerifying] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<string | null>(null);

  const values = { vehicleMake, vehicleModel, vehicleYear, vehicleColor, licensePlateNumber };
  const busy = isSaving || verifying;

  async function handleVerify() {
    const error = validateDriverFields(values);

    if (error) {
      Alert.alert("Missing info", error);
      return;
    }

    setVerifying(true);
    try {
      await upsertDriverProfile(values);
      await startLicenseVerification();

      const row = await getDriverProfile();
      setVerificationStatus(row?.verification_status ?? "pending");
    } catch (err: any) {
      Alert.alert("Verification failed", err?.message ?? "Please try again.");
    } finally {
      setVerifying(false);
    }
  }

  function handleFinish() {
    if (isDriverFieldsEmpty(values)) {
      onSkip();
      return;
    }

    if (!verificationStatus) {
      Alert.alert(
        "Verify your license",
        "Please verify your license before finishing, or tap Skip for now to continue without registering as a driver."
      );
      return;
    }

    const error = validateDriverFields(values);

    if (error) {
      Alert.alert("Missing info", error);
      return;
    }

    onRegister(values);
  }

  return (
    <View style={styles.container}>
      <StepProgressBar
        currentStep={2}
        totalSteps={2}
        stepLabels={["Basic Info", "Driver Details"]}
      />

      <Text style={[styles.title, { color: colors.text, fontFamily: Fonts.sans }]}>
        Register as a Driver
      </Text>

      <InfoCard
        icon="car.fill"
        accent="secondary"
        title="Offer Rides, Build Trust"
        text="Add your vehicle and verify your license so other students know they're riding with someone verified."
      />

      <View
        style={[
          styles.card,
          { backgroundColor: colors.cardBackground, borderColor: colors.outlineVariant },
        ]}
      >
        <View style={styles.cardHeading}>
          <Text style={[styles.cardTitle, { color: colors.text, fontFamily: Fonts.sans }]}>
            Vehicle Details
          </Text>
          <Text style={[styles.cardSubtitle, { color: colors.icon, fontFamily: Fonts.sans }]}>
            Helps other students spot your car
          </Text>
        </View>

        <DriverVehicleFields
          vehicleMake={vehicleMake}
          vehicleModel={vehicleModel}
          vehicleYear={vehicleYear}
          vehicleColor={vehicleColor}
          licensePlateNumber={licensePlateNumber}
          onChangeVehicleMake={setVehicleMake}
          onChangeVehicleModel={setVehicleModel}
          onChangeVehicleYear={setVehicleYear}
          onChangeVehicleColor={setVehicleColor}
          onChangeLicensePlateNumber={setLicensePlateNumber}
          disabled={busy}
        />
      </View>

      <View
        style={[
          styles.card,
          { backgroundColor: colors.cardBackground, borderColor: colors.outlineVariant },
        ]}
      >
        <View style={styles.cardHeadingRow}>
          <Text style={[styles.cardTitle, { color: colors.text, fontFamily: Fonts.sans }]}>
            License &amp; Safety Check
          </Text>
          <StatusPill
            label={verificationStatus === "verified" ? "Verified" : "Action Required"}
            tone={verificationStatus === "verified" ? "success" : "warning"}
          />
        </View>

        <Text style={[styles.cardDescription, { color: colors.icon, fontFamily: Fonts.sans }]}>
          We partner with Didit for instant credential verification. Your documents are only
          used to confirm your license and are never shown to other riders.
        </Text>

        {verificationStatus === "verified" ? (
          <VerifiedBadge />
        ) : (
          <Button
            mode="outlined"
            onPress={handleVerify}
            loading={verifying}
            disabled={busy}
            textColor={colors.tint}
            style={[styles.verifyButton, { borderColor: colors.tint }]}
            contentStyle={styles.buttonContent}
          >
            Verify License via Secure Portal
          </Button>
        )}
      </View>

      <Button onPress={onBack} disabled={busy} textColor={colors.icon}>
        Back
      </Button>

      <Button
        mode="contained"
        onPress={handleFinish}
        loading={isSaving}
        disabled={busy}
        buttonColor={colors.tint}
        textColor={colors.onPrimary}
        style={styles.finishButton}
        contentStyle={styles.buttonContent}
      >
        Save &amp; Complete Profile
      </Button>

      <Button onPress={onSkip} disabled={busy} textColor={colors.icon}>
        Skip for Now (Ride Only)
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 20,
  },

  title: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: "700",
    textAlign: "center",
  },

  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    gap: 14,
  },

  cardHeading: {
    gap: 2,
  },

  cardHeadingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
  },

  cardSubtitle: {
    fontSize: 12,
  },

  cardDescription: {
    fontSize: 13,
    lineHeight: 19,
  },

  verifyButton: {
    borderRadius: 14,
  },

  finishButton: {
    borderRadius: 14,
    marginTop: "auto",
  },

  buttonContent: {
    height: 54,
  },
});
