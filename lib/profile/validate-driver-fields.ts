export type DriverFieldsInput = {
  vehicleMake: string;
  vehicleModel: string;
  vehicleColor: string;
  licensePlateNumber: string;
};

// Loose on purpose: plate formats vary a lot by state/region/country.
const PLATE_PATTERN = /^[A-Za-z0-9 -]+$/;

export function validateDriverFields({
  vehicleMake,
  vehicleModel,
  vehicleColor,
  licensePlateNumber,
}: DriverFieldsInput): string | null {
  if (!vehicleMake.trim()) return "Please enter the vehicle make.";
  if (!vehicleModel.trim()) return "Please enter the vehicle model.";
  if (!vehicleColor.trim()) return "Please enter the vehicle color.";
  if (!licensePlateNumber.trim()) return "Please enter the license plate number.";
  if (!PLATE_PATTERN.test(licensePlateNumber.trim())) {
    return "License plate number can only contain letters, numbers, spaces, and dashes.";
  }
  return null;
}
