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

  const contentType = asset.mimeType ?? "image/jpeg";
  const extension = getFileExtension(contentType);
  const filePath = `${user.id}/avatar.${extension}`;

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

  const { data: publicUrlData } = supabase.storage
    .from("avatars")
    .getPublicUrl(filePath);

  return {
    path: filePath,
    publicUrl: `${publicUrlData.publicUrl}?updated=${Date.now()}`,
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