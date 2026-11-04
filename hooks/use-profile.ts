import { supabase } from "@/lib/supabase";
import { useCallback, useEffect, useState } from "react";
import { Profile, useAuthContext } from "./use-auth-context";

export function useProfile(userId: string | undefined) {
  const {
    claims,
    profile: myProfile,
    isLoading: authLoading,
    refreshProfile,
  } = useAuthContext();
  const currentUserId = claims?.sub as string | undefined;
  const isOwnProfile = !!currentUserId && userId === currentUserId;

  const [otherProfile, setOtherProfile] = useState<Profile | null | undefined>(
    undefined,
  );
  const [isLoadingOther, setIsLoadingOther] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOther = useCallback(async () => {
    if (!userId || isOwnProfile) return;
    setIsLoadingOther(true);
    setError(null);
    try {
      const { data, error: queryError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (queryError) {
        setError(queryError.message);
        setOtherProfile(null);
      } else {
        setOtherProfile(data as Profile | null);
      }
    } finally {
      setIsLoadingOther(false);
    }
  }, [userId, isOwnProfile]);

  useEffect(() => {
    if (!userId || isOwnProfile) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchOther();
  }, [userId, isOwnProfile, fetchOther]);

  const refresh = useCallback(async () => {
    if (isOwnProfile) {
      await refreshProfile();
    } else {
      await fetchOther();
    }
  }, [isOwnProfile, refreshProfile, fetchOther]);

  const profile = isOwnProfile ? myProfile : otherProfile;
  const isLoading = isOwnProfile ? authLoading : isLoadingOther;

  return { profile, isLoading, isOwnProfile, error, refresh };
}
