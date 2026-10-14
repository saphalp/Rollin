import { AuthContext } from "@/hooks/use-auth-context";
import { supabase } from "@/lib/supabase";
import {
  PropsWithChildren,
  useCallback,
  useEffect,
  useState,
} from "react";

type Claims = Record<string, any>;

export default function AuthProvider({
  children,
}: PropsWithChildren) {
  const [claims, setClaims] = useState<
    Claims | null | undefined
  >(undefined);

  const [profile, setProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isLoggedIn = claims != null;

  const isProfileComplete =
    profile?.profile_completed === true;

  const refreshProfile = useCallback(async () => {
    if (!claims?.sub) {
      setProfile(null);
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", claims.sub)
      .single();

    if (error) {
      console.error("Error fetching profile:", error);
      setProfile(null);
      return;
    }

    setProfile(data);
  }, [claims?.sub]);

  useEffect(() => {
    const fetchClaims = async () => {
      setIsLoading(true);

      const { data, error } =
        await supabase.auth.getClaims();

      if (error) {
        console.error("Error fetching claims:", error);
        setClaims(null);
        return;
      }

      setClaims(data?.claims ?? null);
    };

    fetchClaims();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      async (event) => {
        console.log("Auth state changed:", { event });

        const { data, error } =
          await supabase.auth.getClaims();

        if (error) {
          console.error(
            "Error refreshing claims:",
            error
          );

          setClaims(null);
          return;
        }

        setClaims(data?.claims ?? null);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (claims === undefined) {
      return;
    }

    const loadProfile = async () => {
      try {
        await refreshProfile();
      } finally {
        setIsLoading(false);
      }
    };

    loadProfile();
  }, [claims, refreshProfile]);

  return (
    <AuthContext.Provider
      value={{
        claims,
        profile,
        isLoading,
        isLoggedIn,
        isProfileComplete,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
