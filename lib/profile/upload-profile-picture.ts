import { decode } from "base64-arraybuffer";
import type { ImagePickerAsset } from "expo-image-picker";

import { supabase } from "@/lib/supabase";

type UploadProfilePictureResult = {
  path: string;
  publicUrl: string;
};

type ProfileImageField = "profile_picture" | "cover_picture";

export function uploadProfilePicture(
  asset: ImagePickerAsset
): Promise<UploadProfilePictureResult> {
  return uploadProfileImage(asset, "profile_picture", "profile picture", "");
}

export function uploadCoverPicture(
  asset: ImagePickerAsset
): Promise<UploadProfilePictureResult> {
  return uploadProfileImage(asset, "cover_picture", "cover picture", "cover-");
}

// Both images live in the `avatars` bucket under the user's own folder, so
// the bucket's per-user storage policies apply to covers as well.
async function uploadProfileImage(
  asset: ImagePickerAsset,
  field: ProfileImageField,
  label: string,
  filePrefix: string
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
      `You must be signed in to upload a ${label}.`
    );
  }

  if (!asset.base64) {
    throw new Error(
      "The selected image does not contain upload data."
    );
  }

  const { data: existingProfile } = await supabase
    .from("profiles")
    .select(field)
    .eq("id", user.id)
    .single();

  const previousPath =
    (existingProfile as Record<ProfileImageField, string | null> | null)?.[
      field
    ] ?? null;

  const contentType = asset.mimeType ?? "image/jpeg";
  const extension = getFileExtension(contentType);
  // A unique path per upload (rather than a fixed "avatar.ext" path) means
  // the profile column actually changes value each time, so every screen's
  // cached avatar image (keyed by URL) is naturally invalidated instead of
  // silently showing a stale photo forever.
  const filePath = `${user.id}/${filePrefix}${Date.now()}.${extension}`;

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
        [field]: filePath,
      })
      .eq("id", user.id)
      .select("id")
      .single();

  if (profileError) {
    throw profileError;
  }

  if (!updatedProfile) {
    throw new Error(
      `The ${label} uploaded, but the profile record was not updated.`
    );
  }

  if (previousPath && previousPath !== filePath) {
    const { error: removeError } = await supabase.storage
      .from("avatars")
      .remove([previousPath]);

    if (removeError) {
      console.error(`[uploadProfileImage] failed to remove old ${label}:`, removeError);
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