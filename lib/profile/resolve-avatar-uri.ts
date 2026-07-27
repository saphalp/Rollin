import { supabase } from "@/lib/supabase";

export const FALLBACK_AVATAR =
  "https://ui-avatars.com/api/?background=e0e0e0&color=666&name=?";

/**
 * Resolves a `profiles.profile_picture` value (typically a storage path like
 * `user-id/avatar.jpg`) into a viewable URL. Accepts:
 * - null / undefined → FALLBACK_AVATAR
 * - a full URL (starts with http) → returned as-is
 * - anything else → treated as a storage path in the `avatars` bucket
 */
export function resolveAvatarUri(
  profilePicture: string | null | undefined,
): string {
  if (!profilePicture) return FALLBACK_AVATAR;
  if (profilePicture.startsWith("http")) return profilePicture;
  return supabase.storage.from("avatars").getPublicUrl(profilePicture).data
    .publicUrl;
}
