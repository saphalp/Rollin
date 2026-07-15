import { supabase } from "@/lib/supabase";
import { Button } from "react-native";

async function onSignOutButtonPress() {
  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error("Error signing out:", error);
  }
}

export default function LogOutButton() {
  return <Button title="Sign out" onPress={onSignOutButtonPress} />;
}
