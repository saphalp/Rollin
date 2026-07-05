import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import {
  MD3DarkTheme,
  PaperProvider,
  configureFonts,
} from "react-native-paper";
import "react-native-reanimated";
export const unstable_settings = {
  anchor: "(tabs)",
};
const fontConfig = {
  fontFamily: "NunitoSans-Regular",
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
  const [fontsLoaded] = useFonts({
    "NunitoSans-Regular": require("../assets/fonts/nunito.ttf"),
  });

  if (!fontsLoaded) {
    return null;
  }
  return (
    <PaperProvider theme={appTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(auth)" />
      </Stack>
    </PaperProvider>
  );
}
