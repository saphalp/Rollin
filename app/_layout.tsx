import { Colors, Fonts } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
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

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <PaperProvider theme={appTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </PaperProvider>
  );
}
