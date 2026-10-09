import { TourTarget } from '@/components/tutorial/tour-target';
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Image, StyleSheet, TouchableOpacity, View } from "react-native";

import { ProfileSidebar } from "@/components/profile-sidebar";
import { AppText } from "@/components/text";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors, Fonts } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { getProfilePictureUrl } from "@/lib/profile/get-profile-picture";

export default function Header() {
  const theme = useColorScheme() ?? "light";
  const colors = Colors[theme];

  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const [sidebarVisible, setSidebarVisible] = useState(false);

  useEffect(() => {
    async function loadProfilePicture() {
      const url = await getProfilePictureUrl();
      setProfilePicture(url);
    }

    loadProfilePicture();
  }, []);

  return (
    <View style={styles.header}>
      <TourTarget id="header-profile"><TouchableOpacity
        hitSlop={8}
        onPress={() => setSidebarVisible(true)}
      >
        {profilePicture ? (
          <Image
            source={{ uri: profilePicture }}
            style={styles.avatar}
          />
        ) : (
          <View
            style={[
              styles.avatar,
              { backgroundColor: colors.primaryContainer },
            ]}
          />
        )}
      </TouchableOpacity></TourTarget>
      <ProfileSidebar
        visible={sidebarVisible}
        onClose={() => setSidebarVisible(false)}
        profilePictureUrl={profilePicture}
      />

      <AppText
        style={[
          styles.logo,
          { color: colors.tint, fontFamily: Fonts?.rounded },
        ]}
      >
        Rollin&apos;
      </AppText>
      <View style={styles.rightIcons}>
        <TourTarget id="header-calendar"><TouchableOpacity style={styles.tourIcon} hitSlop={8} onPress={() => router.push('/calendar')}>
          <IconSymbol name="calendar" size={24} color={colors.text} style={styles.tourGlyph} />
        </TouchableOpacity></TourTarget>
        <TourTarget id="header-notifications"><TouchableOpacity style={styles.tourIcon} hitSlop={8} onPress={() => router.push('/(tabs)/notifications')}>
          <IconSymbol name="bell.fill" size={24} color={colors.text} style={styles.tourGlyph} />
        </TouchableOpacity></TourTarget>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tourIcon: { width: 24, height: 24, alignItems: "center", justifyContent: "center" },
  tourGlyph: { lineHeight: 24, includeFontPadding: false },
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rightIcons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  logo: {
    fontSize: 22,
    fontWeight: "700",
  },
});
