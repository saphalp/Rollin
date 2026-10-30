import { AccountStateGate } from '@/components/account/AccountStateGate';
import { SplashScreenController } from '@/components/splash';
import { GuidedTourProvider } from '@/components/tutorial/guided-tour-provider';
import { Colors, Fonts } from '@/constants/theme';
import { useAppAnalytics } from '@/hooks/use-app-analytics';
import { useAuthContext } from '@/hooks/use-auth-context';
import { trackError } from '@/lib/analytics';
import AuthProvider from '@/providers/auth-provider';
import { ErrorBoundary as RouterErrorBoundary, Stack, type ErrorBoundaryProps, type Href } from 'expo-router';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { MD3DarkTheme, PaperProvider, configureFonts } from 'react-native-paper';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export const unstable_settings = {
  anchor: "(tabs)",
};

const fonts = configureFonts({ config: { fontFamily: Fonts.sans } });
const appTheme = {
  ...MD3DarkTheme,
  colors: { ...MD3DarkTheme.colors, ...Colors.light },
  fonts,
};

export function RootNavigator() {
  const { isLoggedIn, isProfileComplete, isLoading, needsEmailVerification } = useAuthContext();

  if (isLoading) return null;

  // Where a failed guard sends the user. Since SDK 58 a failed guard redirects instead of
  // removing the route, and without redirectTo Expo Router falls back to the first accessible
  // route in this stack, which can be an arbitrary screen (it was the calendar).
  const entryHref: Href = needsEmailVerification
    ? '/login-verification'
    : !isLoggedIn
      ? '/(auth)'
      : !isProfileComplete
        ? '/(onboarding)'
        : '/(tabs)';

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={needsEmailVerification} redirectTo={entryHref}>
        <Stack.Screen name="login-verification" />
      </Stack.Protected>

      {/* Every signed-in screen must be declared here: an undeclared route has no guard. */}
      <Stack.Protected guard={isLoggedIn && isProfileComplete} redirectTo={entryHref}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="chat/[id]" />
        <Stack.Screen name="profile/[id]" />
        <Stack.Screen name="saved-activities" />
        <Stack.Screen name="my-activities" />
        <Stack.Screen name="reviews/[userId]" />
        <Stack.Screen name="tutorial" />
        <Stack.Screen name="notification-settings" />
        <Stack.Screen name="shared-profile/[id]" />
        <Stack.Screen name="account-center" />
        <Stack.Screen name="edit-profile/index" />
        <Stack.Screen name="edit-profile/driver" />
        <Stack.Screen name="campus-events" />
        <Stack.Screen name="add-campus-calendar" />
        <Stack.Screen name="campus-event/[id]" />
        <Stack.Screen name="host-campus-event/[id]" />
        <Stack.Screen name="report" />
        <Stack.Screen name="calendar" />
        <Stack.Screen name="activity/[id]" />
        <Stack.Screen name="activity/announce/[id]" />
        <Stack.Screen name="activity/cancel/[id]" />
        <Stack.Screen name="activity/edit/[id]" />
        <Stack.Screen name="activity/upload-photo/[id]" />
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

      <Stack.Protected guard={isLoggedIn && !isProfileComplete} redirectTo={entryHref}>
        <Stack.Screen name="(onboarding)" />
        <Stack.Screen name="complete-profile" />
      </Stack.Protected>

      <Stack.Protected guard={!isLoggedIn && !needsEmailVerification} redirectTo={entryHref}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>

      <Stack.Screen name="reset-password" />
    </Stack>
  );
}

// Expo Router renders this when a screen throws. It records the error, then shows the
// router's standard error screen.
export function ErrorBoundary(props: ErrorBoundaryProps) {
  useEffect(() => { trackError(props.error, 'boundary'); }, [props.error]);
  return <RouterErrorBoundary {...props} />;
}

export default function RootLayout() {
  useAppAnalytics();
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PaperProvider theme={appTheme}>
          <AuthProvider>
            <SplashScreenController />
            <GuidedTourProvider>
              <AccountStateGate>
                <RootNavigator />
              </AccountStateGate>
            </GuidedTourProvider>
          </AuthProvider>
        </PaperProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
