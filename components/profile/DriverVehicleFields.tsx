import { Colors, Fonts } from "@/constants/theme";
import { StyleSheet, View } from "react-native";
import { Text, TextInput } from "react-native-paper";

type DriverVehicleFieldsProps = {
  vehicleMake: string;
  vehicleModel: string;
  vehicleYear: string;
  vehicleColor: string;
  licensePlateNumber: string;
  onChangeVehicleMake: (value: string) => void;
  onChangeVehicleModel: (value: string) => void;
  onChangeVehicleYear: (value: string) => void;
  onChangeVehicleColor: (value: string) => void;
  onChangeLicensePlateNumber: (value: string) => void;
  disabled?: boolean;
};

export default function DriverVehicleFields({
  vehicleMake,
  vehicleModel,
  vehicleYear,
  vehicleColor,
  licensePlateNumber,
  onChangeVehicleMake,
  onChangeVehicleModel,
  onChangeVehicleYear,
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
    placeholderTextColor: colors.icon,
    theme: { roundness: 15 },
    style: [styles.input, { backgroundColor: colors.surface }],
  };

  return (
    <View style={styles.form}>
      <View style={styles.fieldGroup}>
        <Text style={[styles.fieldLabel, { color: colors.text, fontFamily: Fonts.sans }]}>
          Vehicle Make
        </Text>
        <TextInput
          {...inputProps}
          placeholder="e.g. Honda"
          value={vehicleMake}
          onChangeText={onChangeVehicleMake}
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={[styles.fieldLabel, { color: colors.text, fontFamily: Fonts.sans }]}>
          Vehicle Model
        </Text>
        <TextInput
          {...inputProps}
          placeholder="e.g. Civic"
          value={vehicleModel}
          onChangeText={onChangeVehicleModel}
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={[styles.fieldLabel, { color: colors.text, fontFamily: Fonts.sans }]}>
          Vehicle Year
        </Text>
        <TextInput
          {...inputProps}
          placeholder="e.g. 2021"
          value={vehicleYear}
          onChangeText={onChangeVehicleYear}
          autoCapitalize="none"
          keyboardType="number-pad"
          maxLength={4}
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={[styles.fieldLabel, { color: colors.text, fontFamily: Fonts.sans }]}>
          Vehicle Color
        </Text>
        <TextInput
          {...inputProps}
          placeholder="e.g. Blue"
          value={vehicleColor}
          onChangeText={onChangeVehicleColor}
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={[styles.fieldLabel, { color: colors.text, fontFamily: Fonts.sans }]}>
          License Plate Number
        </Text>
        <TextInput
          {...inputProps}
          placeholder="e.g. ABC-1234"
          value={licensePlateNumber}
          onChangeText={(value) => onChangeLicensePlateNumber(value.toUpperCase())}
          autoCapitalize="characters"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: 16,
  },

  fieldGroup: {
    gap: 6,
  },

  fieldLabel: {
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  input: {
    fontFamily: Fonts.sans,
  },
});
