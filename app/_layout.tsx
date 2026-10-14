import { GuidedTourProvider } from '@/components/tutorial/guided-tour-provider';
import { SplashScreenController } from "@/components/splash";
import { Colors, Fonts } from "@/constants/theme";
import { useAuthContext } from "@/hooks/use-auth-context";
import AuthProvider from "@/providers/auth-provider";
import { Stack } from "expo-router";
import {
  MD3DarkTheme,
  PaperProvider,
  configureFonts,
} from "react-native-paper";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";

export const unstable_settings = {
  anchor: "index",
};

const fontConfig = {
  fontFamily: Fonts.sans,
};

const fonts = configureFonts({
  config: fontConfig,
});

const appTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    ...Colors.light,
  },
  fonts,
};

export function RootNavigator() {
  const {
    isLoggedIn,
    isProfileComplete,
    isLoading,
    needsEmailVerification,
  } = useAuthContext();

  if (isLoading) {
    return null;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={needsEmailVerification}>
        <Stack.Screen name="login-verification" />
      </Stack.Protected>
      <Stack.Protected
        guard={isLoggedIn && isProfileComplete}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="chat/[id]" />
        <Stack.Screen name="profile/[id]" />
        <Stack.Screen name="saved-activities" />
        <Stack.Screen name="my-activities" />
        <Stack.Screen name="tutorial" />
        <Stack.Screen name="calendar" />
        <Stack.Screen name="complete-profile" />
        <Stack.Screen name="notification-settings" />
        <Stack.Screen name="activity/[id]" />
        <Stack.Screen name="activity/announce/[id]" />
        <Stack.Screen name="activity/edit/[id]" />
        <Stack.Screen name="activity/upload-photo/[id]" />
        <Stack.Screen name="campus-event/[id]" />
        <Stack.Screen name="post/[id]" />
        <Stack.Screen name="ride/[id]" />
        <Stack.Screen name="ride/available" />
        <Stack.Screen name="ride/find" />
        <Stack.Screen name="ride/map" />
        <Stack.Screen name="ride/offer" />
        <Stack.Screen name="ride/request" />
        <Stack.Screen name="ride/ratings/[id]" />
        <Stack.Screen name="ride/tracking/[id]" />
      </Stack.Protected>

      <Stack.Protected
        guard={isLoggedIn && !isProfileComplete}
      >
        <Stack.Screen name="(onboarding)" />
      </Stack.Protected>

      <Stack.Protected guard={!isLoggedIn && !needsEmailVerification}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>

      <Stack.Screen name="reset-password" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PaperProvider theme={appTheme}>
        <AuthProvider>
          <SplashScreenController />
          <GuidedTourProvider><RootNavigator /></GuidedTourProvider>
        </AuthProvider>
      </PaperProvider>
    </GestureHandlerRootView>
  );
}
