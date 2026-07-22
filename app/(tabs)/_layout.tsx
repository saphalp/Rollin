import { Redirect, Tabs } from "expo-router";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Header from "@/components/Header";
import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useAuthContext } from "@/hooks/use-auth-context";

export default function TabLayout() {
  const colorScheme = useColorScheme() ?? "light";
  const insets = useSafeAreaInsets();

  const { isLoggedIn, isLoading } = useAuthContext();
  if (!isLoading && !isLoggedIn) return <Redirect href="/(auth)" />;

  return (
    <View
      style={[
        styles.root,
        { backgroundColor: Colors[colorScheme].background },
      ]}
    >
      <View
        style={[
          styles.headerWrap,
          {
            paddingTop: insets.top + 8,
            backgroundColor: Colors[colorScheme].background,
            borderBottomColor: Colors[colorScheme].outlineVariant,
          },
        ]}
      >
        <Header />
      </View>
      <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme].tint,
        tabBarInactiveTintColor: Colors[colorScheme].tabIconDefault,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          borderTopColor: Colors[colorScheme].outlineVariant,
          borderTopWidth: StyleSheet.hairlineWidth,
        },
        tabBarBackground: () => (
          <View
            style={[
              StyleSheet.absoluteFillObject,
              { backgroundColor: Colors[colorScheme].background },
            ]}
          />
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={24} name="house.fill" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: "Explore",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={24} name="safari" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="post"
        options={{
          title: "Post",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={24} name="plus.circle" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="rides"
        options={{
          title: "Rides",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={24} name="car.fill" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="chats"
        options={{
          title: "Chats",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={24} name="bubble.left.fill" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={24} name="person.fill" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{ href: null }}
      />
    </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  headerWrap: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
