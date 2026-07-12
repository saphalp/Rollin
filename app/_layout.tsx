import { SplashScreenController } from "@/components/splash";
import { Colors, Fonts } from "@/constants/theme";
import { useAuthContext } from "@/hooks/use-auth-context";
import { useColorScheme } from "@/hooks/use-color-scheme";
import AuthProvider from "@/providers/auth-provider";
import { Stack } from "expo-router";
import {
  MD3DarkTheme,
  PaperProvider,
  configureFonts,
} from "react-native-paper";
import "react-native-reanimated";

export const unstable_settings = {
  anchor: "index",
};

const fontConfig = {
  fontFamily: Fonts.sans,
};

const fonts = configureFonts({ config: fontConfig });
const appTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    ...Colors.light,
  },
  fonts,
};

export function RootNavigator() {
  const { isLoggedIn } = useAuthContext();
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={isLoggedIn}>
        <Stack.Screen name="(tabs)" />
      </Stack.Protected>
      <Stack.Protected guard={!isLoggedIn}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <PaperProvider theme={appTheme}>
      <AuthProvider>
        <SplashScreenController />
        <RootNavigator />
      </AuthProvider>
    </PaperProvider>
  );
}
