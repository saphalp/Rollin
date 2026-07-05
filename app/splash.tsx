import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";

SplashScreen.setOptions({
  duration: 5000,
  fade: true,
});

export default function RootLayout() {
  return <Stack />;
}
