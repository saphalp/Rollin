import { supabase } from "@/lib/supabase";

export type CompleteProfileData = {
  fullName: string;
  university: string;
  major: string;
};

export async function completeProfile({
  fullName,
  university,
  major,
}: CompleteProfileData) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!user) {
    throw new Error("You must be signed in to complete your profile.");
  }

  const { data, error } = await supabase
    .from("profiles")
    .update({
      full_name: fullName.trim(),
      university: university.trim(),
      major: major.trim(),
      profile_completed: true,
    })
    .eq("id", user.id)
    .select(
      "id, full_name, university, major, profile_completed"
    )
    .single();

  if (error) {
    throw error;
  }

  return data;
}