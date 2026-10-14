import { AccountStateGate } from '@/components/account/AccountStateGate';
import { SplashScreenController } from '@/components/splash';
import { GuidedTourProvider } from '@/components/tutorial/guided-tour-provider';
import { Colors, Fonts } from '@/constants/theme';
import { useAuthContext } from '@/hooks/use-auth-context';
import AuthProvider from '@/providers/auth-provider';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { MD3DarkTheme, PaperProvider, configureFonts } from 'react-native-paper';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export const unstable_settings = { anchor: 'index' };

const fonts = configureFonts({ config: { fontFamily: Fonts.sans } });
const appTheme = {
  ...MD3DarkTheme,
  colors: { ...MD3DarkTheme.colors, ...Colors.light },
  fonts,
};

export function RootNavigator() {
  const { isLoggedIn, isProfileComplete, isLoading } = useAuthContext();

  if (isLoading) return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={isLoggedIn && isProfileComplete}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="chat/[id]" />
        <Stack.Screen name="profile/[id]" />
        <Stack.Screen name="saved-activities" />
        <Stack.Screen name="my-activities" />
        <Stack.Screen name="tutorial" />
        <Stack.Screen name="shared-profile/[id]" />
        <Stack.Screen name="account-center" />
        <Stack.Screen name="campus-events" />
        <Stack.Screen name="campus-event/[id]" />
        <Stack.Screen name="host-campus-event/[id]" />
      </Stack.Protected>

      <Stack.Protected guard={isLoggedIn && !isProfileComplete}>
        <Stack.Screen name="(onboarding)" />
      </Stack.Protected>

      <Stack.Protected guard={!isLoggedIn}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>

      <Stack.Screen name="reset-password" />
    </Stack>
  );
}

export default function RootLayout() {
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
