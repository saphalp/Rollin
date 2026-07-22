import { supabase } from "@/lib/supabase";

export async function getProfilePictureUrl(): Promise<string | null> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!user) {
    return null;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("profile_picture")
    .eq("id", user.id)
    .single();

  if (profileError) {
    throw profileError;
  }

  if (!profile?.profile_picture) {
    return null;
  }

  const { data } = supabase.storage
    .from("avatars")
    .getPublicUrl(profile.profile_picture);

  return `${data.publicUrl}?updated=${Date.now()}`;
}