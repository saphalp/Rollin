import { Redirect, Stack } from "expo-router";

export default function AuthLayout() {
  const isLoggedIn = true; // TODO: replace with real auth check

  if (isLoggedIn) return <Redirect href="/(tabs)" />;
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="signup" />
    </Stack>
  );
}
