import { Colors, Fonts } from "@/constants/theme";
import { StyleSheet, View } from "react-native";
import { TextInput } from "react-native-paper";

type DriverVehicleFieldsProps = {
  vehicleMake: string;
  vehicleModel: string;
  vehicleColor: string;
  licensePlateNumber: string;
  onChangeVehicleMake: (value: string) => void;
  onChangeVehicleModel: (value: string) => void;
  onChangeVehicleColor: (value: string) => void;
  onChangeLicensePlateNumber: (value: string) => void;
  disabled?: boolean;
};

export default function DriverVehicleFields({
  vehicleMake,
  vehicleModel,
  vehicleColor,
  licensePlateNumber,
  onChangeVehicleMake,
  onChangeVehicleModel,
  onChangeVehicleColor,
  onChangeLicensePlateNumber,
  disabled,
}: DriverVehicleFieldsProps) {
  const colors = Colors.light;

  const inputProps = {
    mode: "outlined" as const,
    autoCapitalize: "words" as const,
    disabled,
    outlineColor: colors.outlineVariant,
    activeOutlineColor: colors.tint,
    textColor: colors.text,
    style: [
      styles.input,
      { backgroundColor: colors.surfaceContainerHigh },
    ],
  };

  return (
    <View style={styles.form}>
      <TextInput
        {...inputProps}
        label="Vehicle Make"
        value={vehicleMake}
        onChangeText={onChangeVehicleMake}
      />

      <TextInput
        {...inputProps}
        label="Vehicle Model"
        value={vehicleModel}
        onChangeText={onChangeVehicleModel}
      />

      <TextInput
        {...inputProps}
        label="Vehicle Color"
        value={vehicleColor}
        onChangeText={onChangeVehicleColor}
      />

      <TextInput
        {...inputProps}
        label="License Plate Number"
        value={licensePlateNumber}
        onChangeText={onChangeLicensePlateNumber}
        autoCapitalize="characters"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: 16,
  },

  input: {
    fontFamily: Fonts.sans,
  },
});
