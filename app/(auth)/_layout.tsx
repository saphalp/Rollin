import { Redirect, Stack } from "expo-router";

export default function AuthLayout() {
  const isLoggedIn = false; // TODO: replace with real auth check

  if (isLoggedIn) return <Redirect href="/(tabs)" />;
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="EmailConfirmation" />
    </Stack>
  );
}
