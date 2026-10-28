import { supabase } from "@/lib/supabase";
import { getCurrentUniversity } from "@/lib/university";

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

  const assignedUniversity = await getCurrentUniversity();
  let universityToSave = assignedUniversity?.name ?? '';
  if (!assignedUniversity && university.trim()) {
    const { data: option, error: universityError } = await supabase
      .from('university_directory')
      .select('name')
      .eq('name', university.trim())
      .maybeSingle();
    if (universityError) throw universityError;
    if (!option) throw new Error('Please select a university from the list.');
    universityToSave = option.name;
  }

  const { data, error } = await supabase
    .from("profiles")
    .update({
      full_name: fullName.trim(),
      university: universityToSave,
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