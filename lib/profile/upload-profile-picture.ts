import { decode } from "base64-arraybuffer";
import type { ImagePickerAsset } from "expo-image-picker";

import { supabase } from "@/lib/supabase";

type UploadProfilePictureResult = {
  path: string;
  publicUrl: string;
};

export async function uploadProfilePicture(
  asset: ImagePickerAsset
): Promise<UploadProfilePictureResult> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!user) {
    throw new Error(
      "You must be signed in to upload a profile picture."
    );
  }

  if (!asset.base64) {
    throw new Error(
      "The selected image does not contain upload data."
    );
  }

  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("profile_picture")
    .eq("id", user.id)
    .single();

  const previousPath = existingProfile?.profile_picture ?? null;

  const contentType = asset.mimeType ?? "image/jpeg";
  const extension = getFileExtension(contentType);
  // A unique path per upload (rather than a fixed "avatar.ext" path) means
  // profile_picture actually changes value each time, so every screen's
  // cached avatar image (keyed by URL) is naturally invalidated instead of
  // silently showing a stale photo forever.
  const filePath = `${user.id}/${Date.now()}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(filePath, decode(asset.base64), {
      contentType,
      cacheControl: "3600",
      upsert: true,
    });

  if (uploadError) {
    throw uploadError;
  }

  const { data: updatedProfile, error: profileError } =
    await supabase
      .from("profiles")
      .update({
        profile_picture: filePath,
      })
      .eq("id", user.id)
      .select("id, profile_picture")
      .single();

  if (profileError) {
    throw profileError;
  }

  if (!updatedProfile) {
    throw new Error(
      "The profile picture uploaded, but the profile record was not updated."
    );
  }

  if (previousPath && previousPath !== filePath) {
    const { error: removeError } = await supabase.storage
      .from("avatars")
      .remove([previousPath]);

    if (removeError) {
      console.error("[uploadProfilePicture] failed to remove old avatar:", removeError);
    }
  }

  const { data: publicUrlData } = supabase.storage
    .from("avatars")
    .getPublicUrl(filePath);

  return {
    path: filePath,
    publicUrl: publicUrlData.publicUrl,
  };
}

function getFileExtension(contentType: string): string {
  switch (contentType) {
    case "image/png":
      return "png";

    case "image/webp":
      return "webp";

    case "image/jpeg":
    case "image/jpg":
    default:
      return "jpg";
  }
}