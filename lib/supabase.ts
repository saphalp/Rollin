import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import "expo-sqlite/localStorage/install";
import "react-native-url-polyfill/auto";

const supabaseUrl: any = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabasePublishableKey: any =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    storage: AsyncStorage,
    flowType: "pkce", // required — exchangeCodeForSession needs the verifier
    detectSessionInUrl: false, // native has no URL bar
    autoRefreshToken: true,
    persistSession: true,
  },
});
