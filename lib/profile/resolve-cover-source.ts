import type { ImageSourcePropType } from "react-native";

import { supabase } from "@/lib/supabase";

export const DEFAULT_COVER: ImageSourcePropType = require("@/assets/images/default-cover.jpg");

/**
 * Resolves a `profiles.cover_picture` value into an image source. Accepts:
 * - null / undefined → the bundled DEFAULT_COVER
 * - a full URL (starts with http) → used as-is
 * - anything else → treated as a storage path in the `avatars` bucket
 */
export function resolveCoverSource(
  coverPicture: string | null | undefined,
): ImageSourcePropType {
  if (!coverPicture) return DEFAULT_COVER;
  if (coverPicture.startsWith("http")) return { uri: coverPicture };
  return {
    uri: supabase.storage.from("avatars").getPublicUrl(coverPicture).data
      .publicUrl,
  };
}
