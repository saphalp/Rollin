import { useCallback, useEffect, useState } from "react";

import { useAuthContext } from "@/hooks/use-auth-context";
import { resolveAvatarUri } from "@/lib/profile/resolve-avatar-uri";
import { supabase } from "@/lib/supabase";

export type FollowedUser = {
  id: string;
  fullName: string;
  avatarUri: string;
};

export function useFollowedUsers(enabled: boolean) {
  const { claims } = useAuthContext();
  const currentUserId = claims?.sub as string | undefined;

  const [users, setUsers] = useState<FollowedUser[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchFollowedUsers = useCallback(async () => {
    if (!currentUserId) {
      setUsers([]);
      return;
    }

    setLoading(true);

    const { data: followRows } = await supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", currentUserId)
      .eq("status", "accepted");

    const followingIds = (followRows ?? []).map(
      (row: any) => row.following_id,
    );

    if (followingIds.length === 0) {
      setUsers([]);
      setLoading(false);
      return;
    }

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, profile_picture")
      .in("id", followingIds);

    setUsers(
      (profiles ?? []).map((profile: any) => ({
        id: profile.id,
        fullName: profile.full_name ?? "Rollin' User",
        avatarUri: resolveAvatarUri(profile.profile_picture),
      })),
    );

    setLoading(false);
  }, [currentUserId]);

  useEffect(() => {
    if (enabled) {
      void fetchFollowedUsers();
    }
  }, [enabled, fetchFollowedUsers]);

  return { users, loading, refresh: fetchFollowedUsers };
}
