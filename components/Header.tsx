import { TourTarget } from '@/components/tutorial/tour-target';
import { router } from "expo-router";
import { useState } from "react";
import { Image, StyleSheet, TouchableOpacity, View } from "react-native";

import { ProfileSidebar } from "@/components/profile-sidebar";
import { AppText } from "@/components/text";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors, Fonts } from "@/constants/theme";
import { useAuthContext } from "@/hooks/use-auth-context";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useUnreadNotifications } from "@/hooks/use-unread-notifications";
import { resolveAvatarUri } from "@/lib/profile/resolve-avatar-uri";

export default function Header() {
  const theme = useColorScheme() ?? "light";
  const colors = Colors[theme];
  const { profile } = useAuthContext();

  const [sidebarVisible, setSidebarVisible] = useState(false);
  const hasUnread = useUnreadNotifications();

  const profilePicture = profile?.profile_picture
    ? resolveAvatarUri(profile.profile_picture)
    : null;

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
        <TourTarget id="header-notifications"><TouchableOpacity
          style={styles.tourIcon}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={hasUnread ? "Notifications, unread" : "Notifications"}
          onPress={() => router.push('/notifications')}
        >
          <IconSymbol name="bell.fill" size={24} color={colors.text} style={styles.tourGlyph} />
          {hasUnread && (
            <View
              pointerEvents="none"
              style={[styles.unreadDot, { backgroundColor: colors.error, borderColor: colors.background }]}
            />
          )}
        </TouchableOpacity></TourTarget>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tourIcon: { width: 24, height: 24, alignItems: "center", justifyContent: "center" },
  tourGlyph: { lineHeight: 24, includeFontPadding: false },
  unreadDot: {
    position: "absolute",
    top: -1,
    right: -1,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
  },
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
