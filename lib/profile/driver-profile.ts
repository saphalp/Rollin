import { supabase } from "@/lib/supabase";

export type DriverProfileInput = {
  vehicleMake: string;
  vehicleModel: string;
  vehicleColor: string;
  licensePlateNumber: string;
};

const DRIVER_PROFILE_COLUMNS =
  "profile_id, vehicle_make, vehicle_model, vehicle_color, license_plate_number, verification_status, created_at, updated_at";

export async function upsertDriverProfile({
  vehicleMake,
  vehicleModel,
  vehicleColor,
  licensePlateNumber,
}: DriverProfileInput) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!user) {
    throw new Error("You must be signed in to register as a driver.");
  }

  const { data, error } = await supabase
    .from("driver_profiles")
    .upsert(
      {
        profile_id: user.id,
        vehicle_make: vehicleMake.trim(),
        vehicle_model: vehicleModel.trim(),
        vehicle_color: vehicleColor.trim(),
        license_plate_number: licensePlateNumber.trim().toUpperCase(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "profile_id" }
    )
    .select(DRIVER_PROFILE_COLUMNS)
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function getDriverProfile(userId: string) {
  const { data, error } = await supabase
    .from("driver_profiles")
    .select(DRIVER_PROFILE_COLUMNS)
    .eq("profile_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}
