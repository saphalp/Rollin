import { supabase } from "@/lib/supabase";
import { useEffect, useState } from "react";
import { Profile, useAuthContext } from "./use-auth-context";

export function useProfile(userId: string | undefined) {
  const {
    claims,
    profile: myProfile,
    isLoading: authLoading,
  } = useAuthContext();
  const currentUserId = claims?.sub as string | undefined;
  const isOwnProfile = !!currentUserId && userId === currentUserId;

  const [otherProfile, setOtherProfile] = useState<Profile | null | undefined>(
    undefined,
  );
  const [isLoadingOther, setIsLoadingOther] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId || isOwnProfile) return;

    let cancelled = false;
    setIsLoadingOther(true);
    setError(null);

    (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        setError(error.message);
        setOtherProfile(null);
      } else {
        setOtherProfile(data as Profile | null);
      }
      setIsLoadingOther(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, isOwnProfile]);

  const profile = isOwnProfile ? myProfile : otherProfile;
  const isLoading = isOwnProfile ? authLoading : isLoadingOther;

  return { profile, isLoading, isOwnProfile, error };
}
