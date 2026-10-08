export type DriverFieldsInput = {
  vehicleMake: string;
  vehicleModel: string;
  vehicleYear: string;
  vehicleColor: string;
  licensePlateNumber: string;
};

// Loose on purpose: plate formats vary a lot by state/region/country.
const PLATE_PATTERN = /^[A-Za-z0-9 -]+$/;
const MIN_VEHICLE_YEAR = 1900;
const MAX_VEHICLE_YEAR = new Date().getFullYear() + 1;

export function isDriverFieldsEmpty({
  vehicleMake,
  vehicleModel,
  vehicleYear,
  vehicleColor,
  licensePlateNumber,
}: DriverFieldsInput): boolean {
  return (
    !vehicleMake.trim() &&
    !vehicleModel.trim() &&
    !vehicleYear.trim() &&
    !vehicleColor.trim() &&
    !licensePlateNumber.trim()
  );
}

export function validateDriverFields({
  vehicleMake,
  vehicleModel,
  vehicleYear,
  vehicleColor,
  licensePlateNumber,
}: DriverFieldsInput): string | null {
  if (!vehicleMake.trim()) return "Please enter the vehicle make.";
  if (!vehicleModel.trim()) return "Please enter the vehicle model.";

  const year = Number(vehicleYear.trim());
  if (!vehicleYear.trim() || !Number.isInteger(year)) {
    return "Please enter a valid vehicle year.";
  }
  if (year < MIN_VEHICLE_YEAR || year > MAX_VEHICLE_YEAR) {
    return `Vehicle year must be between ${MIN_VEHICLE_YEAR} and ${MAX_VEHICLE_YEAR}.`;
  }

  if (!vehicleColor.trim()) return "Please enter the vehicle color.";
  if (!licensePlateNumber.trim()) return "Please enter the license plate number.";
  if (!PLATE_PATTERN.test(licensePlateNumber.trim())) {
    return "License plate number can only contain letters, numbers, spaces, and dashes.";
  }
  return null;
}
