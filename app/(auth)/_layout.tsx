import { Redirect, Stack } from "expo-router";
import { useAuthContext } from "@/hooks/use-auth-context";

export default function AuthLayout() {
  const { isLoggedIn, isLoading } = useAuthContext();

  if (!isLoading && isLoggedIn) return <Redirect href="/(tabs)" />;
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="EmailConfirmation" />
    </Stack>
  );
}
