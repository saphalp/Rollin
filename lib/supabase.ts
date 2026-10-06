import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import "expo-sqlite/localStorage/install";
import "react-native-url-polyfill/auto";

const supabaseUrl: any = process.env.https://cvzvcacndztznbkihdzg.supabase.co/;
const supabasePublishableKey: any =
  process.env.sb_publishable_duSWDgM3Xh - uJPhUKLOIKg_YYsOXusG;

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    storage: AsyncStorage,
    flowType: "pkce", // required — exchangeCodeForSession needs the verifier
    detectSessionInUrl: false, // native has no URL bar
    autoRefreshToken: true,
    persistSession: true,
  },
});
