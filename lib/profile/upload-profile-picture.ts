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

/**
 * Extracts binary ArrayBuffer data from an ImagePickerAsset.
 * On Android, expo-image-picker often omits base64 after cropping or for high-res photos.
 * This reads from asset.base64 if present, or falls back to reading asset.uri via
 * expo-file-system or fetch blob.
 */
export async function getAssetArrayBuffer(
  asset: ImagePickerAsset
): Promise<ArrayBuffer> {
  if (asset.base64 && typeof asset.base64 === "string" && asset.base64.trim().length > 0) {
    const raw = asset.base64;
    const clean = raw.includes(",") ? raw.split(",")[1] : raw;
    try {
      return decode(clean.trim());
    } catch (decodeErr) {
      console.warn("[uploadProfileImage] asset.base64 decode failed, falling back to uri:", decodeErr);
    }
  }

  if (asset.uri) {
    // 1. Try expo-file-system/legacy readAsStringAsync (reliable on Android content:// and file://)
    try {
      const legacyFs = await import("expo-file-system/legacy");
      if (legacyFs && typeof legacyFs.readAsStringAsync === "function") {
        const base64 = await legacyFs.readAsStringAsync(asset.uri, {
          encoding: "base64",
        });
        if (base64) {
          const clean = base64.includes(",") ? base64.split(",")[1] : base64;
          return decode(clean.trim());
        }
      }
    } catch {
      // Continue to next fallback
    }

    // 2. Try modern expo-file-system File API
    try {
      const { File } = await import("expo-file-system");
      if (File) {
        const file = new File(asset.uri);
        if (typeof file.arrayBuffer === "function") {
          const buffer = await file.arrayBuffer();
          if (buffer && buffer.byteLength > 0) {
            return buffer;
          }
        }
      }
    } catch {
      // Continue to next fallback
    }

    // 3. Try standard fetch(asset.uri) Blob -> ArrayBuffer
    try {
      const response = await fetch(asset.uri);
      if (typeof response.arrayBuffer === "function") {
        const buffer = await response.arrayBuffer();
        if (buffer && buffer.byteLength > 0) {
          return buffer;
        }
      }
      if (typeof response.blob === "function") {
        const blob = await response.blob();
        if (typeof blob.arrayBuffer === "function") {
          return await blob.arrayBuffer();
        }
      }
    } catch {
      // Fallback failed
    }
  }

  throw new Error("The selected image does not contain upload data.");
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

  const uploadData = await getAssetArrayBuffer(asset);

  const { data: existingProfile } = await supabase
    .from("profiles")
    .select(field)
    .eq("id", user.id)
    .single();

  const previousPath =
    (existingProfile as Record<ProfileImageField, string | null> | null)?.[
      field
    ] ?? null;

  const contentType = getContentType(asset);
  const extension = getFileExtension(contentType, asset.uri);
  // A unique path per upload (rather than a fixed "avatar.ext" path) means
  // the profile column actually changes value each time, so every screen's
  // cached avatar image (keyed by URL) is naturally invalidated instead of
  // silently showing a stale photo forever.
  const filePath = `${user.id}/${filePrefix}${Date.now()}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(filePath, uploadData, {
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
    const cleanPreviousPath = previousPath.startsWith("http")
      ? previousPath.split("/avatars/")[1] ?? previousPath
      : previousPath;

    const { error: removeError } = await supabase.storage
      .from("avatars")
      .remove([cleanPreviousPath]);

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

function getContentType(asset: ImagePickerAsset): string {
  if (asset.mimeType && asset.mimeType.length > 0) {
    return asset.mimeType;
  }
  const ext = getFileExtension("", asset.uri);
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  return "image/jpeg";
}

function getFileExtension(contentType: string, uri?: string): string {
  const normalized = (contentType || "").toLowerCase();
  if (normalized.includes("png")) return "png";
  if (normalized.includes("webp")) return "webp";
  if (normalized.includes("jpeg") || normalized.includes("jpg")) return "jpg";
  if (normalized.includes("gif")) return "gif";
  if (normalized.includes("heic") || normalized.includes("heif")) return "jpg";

  if (uri) {
    const cleanUri = uri.split("?")[0].toLowerCase();
    if (cleanUri.endsWith(".png")) return "png";
    if (cleanUri.endsWith(".webp")) return "webp";
    if (cleanUri.endsWith(".gif")) return "gif";
    if (cleanUri.endsWith(".jpg") || cleanUri.endsWith(".jpeg")) return "jpg";
  }

  return "jpg";
}
