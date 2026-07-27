import { createContext, useContext } from "react";

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  university: string | null;
  major: string | null;
  profile_picture: string | null;
  is_educational_email: boolean | null;
  educational_domain_checked_at: string | null;
  profile_completed: boolean;
  created_at: string;
};

export type AuthData = {
  claims?: Record<string, any> | null;
  profile?: Profile | null;
  isLoading: boolean;
  isLoggedIn: boolean;
  isProfileComplete: boolean;
  refreshProfile: () => Promise<void>;
};

export const AuthContext = createContext<AuthData>({
  claims: undefined,
  profile: undefined,
  isLoading: true,
  isLoggedIn: false,
  isProfileComplete: false,
  refreshProfile: async () => {},
});

export const useAuthContext = () => useContext(AuthContext);