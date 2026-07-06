import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Redirect } from "expo-router";
import { Button } from "react-native-paper";
import {useFonts} from "expo-font"

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const isLoggedIn = false;
  if (!isLoggedIn) return <Redirect href="/(auth)" />;
  return (
    <>
      <Button buttonColor={Colors.light.primaryContainer}>Click me</Button>
    </>
    // <Tabs
    //   screenOptions={{
    //     tabBarActiveTintColor: Colors[colorScheme ?? "light"].tint,
    //     headerShown: false,
    //     tabBarButton: HapticTab,
    //   }}
    // >
    //   <Tabs.Screen
    //     name="index"
    //     options={{
    //       title: "Home",
    //       tabBarIcon: ({ color }) => (
    //         <IconSymbol size={28} name="house.fill" color={color} />
    //       ),
    //     }}
    //   />
    //   <Tabs.Screen
    //     name="explore"
    //     options={{
    //       title: "Explore",
    //       tabBarIcon: ({ color }) => (
    //         // <IconSymbol size={28} name="paperplane.fill" color={color} />
    //       ),
    //     }}
    //   />
    // </Tabs>
  );
}
