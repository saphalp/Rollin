import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Text, TextInput } from "react-native-paper";

import { SelectField } from "@/components/profile/SelectField";
import { Colors, Fonts } from "@/constants/theme";
import { fetchVehicleModels, VEHICLE_MAKES, vehicleYearOptions } from "@/lib/vehicle-data";

const YEAR_OPTIONS = vehicleYearOptions();

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

  const [modelOptions, setModelOptions] = useState<string[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);

  useEffect(() => {
    if (!vehicleMake) {
      setModelOptions([]);
      return;
    }

    let active = true;
    setModelsLoading(true);

    fetchVehicleModels(vehicleMake)
      .then((models) => {
        if (active) setModelOptions(models);
      })
      .catch(() => {
        if (active) setModelOptions([]);
      })
      .finally(() => {
        if (active) setModelsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [vehicleMake]);

  function handleMakeChange(make: string) {
    onChangeVehicleMake(make);
    onChangeVehicleModel("");
  }

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
      <SelectField
        label="Vehicle Make"
        value={vehicleMake}
        options={VEHICLE_MAKES}
        onChange={handleMakeChange}
        placeholder="Select a make"
        disabled={disabled}
      />

      <SelectField
        label="Vehicle Model"
        value={vehicleModel}
        options={modelOptions}
        onChange={onChangeVehicleModel}
        placeholder={vehicleMake ? "Select a model" : "Select a make first"}
        disabled={disabled || !vehicleMake}
        loading={modelsLoading}
        emptyMessage={modelsLoading ? "Loading models…" : "No models found for this make"}
      />

      <SelectField
        label="Vehicle Year"
        value={vehicleYear}
        options={YEAR_OPTIONS}
        onChange={onChangeVehicleYear}
        placeholder="Select a year"
        disabled={disabled}
      />

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
