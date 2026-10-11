import { registerPushToken } from "@/lib/notifications/register-push-token";
import { Redirect, Tabs } from "expo-router";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { RatingReminder } from '@/components/rides/rating-reminder';
import { useGuidedTour } from '@/components/tutorial/guided-tour-provider';
import Header from "@/components/Header";
import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors } from "@/constants/theme";
import { useAuthContext } from "@/hooks/use-auth-context";
import { useColorScheme } from "@/hooks/use-color-scheme";

function MainTabs() {
  const colorScheme = useColorScheme() ?? "light";
  const insets = useSafeAreaInsets();
  const { promptsBlocked } = useGuidedTour();

  const { isLoggedIn, isLoading } = useAuthContext();
  useEffect(() => {
    if (!isLoading && isLoggedIn && !promptsBlocked) {
      registerPushToken();
    }
  }, [isLoading, isLoggedIn, promptsBlocked]);
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
      {!promptsBlocked && <RatingReminder />}
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
                StyleSheet.absoluteFill,
                { backgroundColor: Colors[colorScheme].background },
              ]}
            />
          ),
          sceneStyle: [
            styles.scenePadding,
            { backgroundColor: Colors[colorScheme].background },
          ],
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Home",
            tabBarButton: props => <HapticTab {...props} tourId="tab-home" />,
            tabBarIcon: ({ color }) => (
              <IconSymbol size={24} name="house.fill" color={color} style={styles.tourGlyph} />
            ),
          }}
        />
        <Tabs.Screen
          name="explore"
          options={{
            title: "Explore",
            tabBarButton: props => <HapticTab {...props} tourId="tab-explore" />,
            tabBarIcon: ({ color }) => (
              <IconSymbol size={24} name="safari" color={color} style={styles.tourGlyph} />
            ),
          }}
        />
        <Tabs.Screen
          name="post"
          options={{
            title: "Post",
            tabBarButton: props => <HapticTab {...props} tourId="tab-post" />,
            tabBarIcon: ({ color }) => (
              <IconSymbol size={24} name="plus.circle" color={color} style={styles.tourGlyph} />
            ),
          }}
        />
        <Tabs.Screen
          name="rides"
          options={{
            title: "Rides",
            tabBarButton: props => <HapticTab {...props} tourId="tab-rides" />,
            tabBarIcon: ({ color }) => (
              <IconSymbol size={24} name="car.fill" color={color} style={styles.tourGlyph} />
            ),
          }}
        />
        <Tabs.Screen
          name="chats"
          options={{
            title: "Chats",
            tabBarButton: props => <HapticTab {...props} tourId="tab-chats" />,
            tabBarIcon: ({ color }) => (
              <IconSymbol size={24} name="bubble.left.fill" color={color} style={styles.tourGlyph} />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: "Profile",
            tabBarButton: props => <HapticTab {...props} tourId="tab-profile" />,
            tabBarIcon: ({ color }) => (
              <IconSymbol size={24} name="person.fill" color={color} style={styles.tourGlyph} />
            ),
            sceneStyle: [
              styles.noScenePadding,
              { backgroundColor: Colors[colorScheme].background },
            ],
          }}
        />
        <Tabs.Screen
          name="notifications"
          options={{
            href: null,
            sceneStyle: [
              styles.scenePaddingNoHorizontal,
              { backgroundColor: Colors[colorScheme].background },
            ],
          }}
        />
      </Tabs>
    </View>
  );
}

export default function TabLayout() {
  const { claims, isLoggedIn, isLoading } = useAuthContext();
  if (isLoading) return null;
  if (!isLoggedIn || !claims?.sub) return <Redirect href="/(auth)" />;
  return <MainTabs />;
}

const styles = StyleSheet.create({
  tourGlyph: { lineHeight: 24, includeFontPadding: false },
  root: {
    flex: 1,
  },
  headerWrap: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  scenePadding: {
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  scenePaddingNoHorizontal: {
    paddingTop: 20,
  },
  noScenePadding: {
    paddingHorizontal: 0,
    paddingTop: 0,
  },
});
