import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Image, Modal, Pressable, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EditProfileSheet } from '@/components/profile/EditProfileSheet';
import { AppText } from '@/components/text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Fonts } from '@/constants/theme';
import { useAuthContext } from '@/hooks/use-auth-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { supabase } from '@/lib/supabase';

type Props = {
  visible: boolean;
  onClose: () => void;
  profilePictureUrl?: string | null;
};

const SIDEBAR_WIDTH = 280;

export function ProfileSidebar({ visible, onClose, profilePictureUrl }: Props) {
  const theme = useColorScheme() ?? 'light';
  const colors = Colors[theme];
  const insets = useSafeAreaInsets();
  const { profile, refreshProfile } = useAuthContext();
  const slideAnim = useRef(new Animated.Value(-SIDEBAR_WIDTH)).current;
  const [editSheetVisible, setEditSheetVisible] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: visible ? 0 : -SIDEBAR_WIDTH,
      useNativeDriver: true,
      tension: 65,
      friction: 9,
    }).start();
  }, [visible]);

  async function handleSignOut() {
    onClose();
    await supabase.auth.signOut();
  }

  function navigate(path: string) {
    onClose();
    router.push(path as any);
  }

  function handleEditPress() {
    onClose();
    setTimeout(() => setEditSheetVisible(true), 300);
  }

  function confirmReset() {
    const email = profile?.email ?? '';
    Alert.alert('Reset password?', `We'll send a password reset code to ${email}.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Send Code', onPress: () => sendResetCode(email) },
    ]);
  }

  async function sendResetCode(email: string) {
    if (sendingReset) return;
    setSendingReset(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase());
    setSendingReset(false);

    if (error) {
      Alert.alert(
        'Unable to send reset code',
        error.status === 429
          ? 'Please wait before requesting another code.'
          : 'Please check your connection and try again.',
      );
      return;
    }

    onClose();
    router.push({ pathname: '/reset-password', params: { email: email.trim().toLowerCase(), source: 'profile' } } as never);
  }

  return (
    <>
      <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
        <View style={styles.container}>
          <Animated.View
            style={[
              styles.sidebar,
              { backgroundColor: colors.cardBackground, paddingTop: insets.top + 20 },
              { transform: [{ translateX: slideAnim }] },
            ]}
          >
            <View style={styles.profileSection}>
              {profilePictureUrl ? (
                <Image source={{ uri: profilePictureUrl }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, { backgroundColor: colors.primaryContainer }]} />
              )}
              <AppText style={[styles.name, { color: colors.text, fontFamily: Fonts?.sans }]} numberOfLines={1}>
                {profile?.full_name ?? profile?.email?.split('@')[0] ?? "Rollin' User"}
              </AppText>
              {profile?.email ? (
                <AppText style={[styles.email, { color: colors.outline, fontFamily: Fonts?.sans }]} numberOfLines={1}>
                  {profile.email}
                </AppText>
              ) : null}
            </View>

            <View style={[styles.divider, { backgroundColor: colors.outlineVariant }]} />

            <TouchableOpacity style={styles.menuItem} onPress={() => navigate('/(tabs)/profile')}>
              <IconSymbol name="person.fill" size={20} color={colors.icon} />
              <AppText style={[styles.menuText, { color: colors.text, fontFamily: Fonts?.sans }]}>View Profile</AppText>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={() => navigate('/saved-activities')}>
              <IconSymbol name="bookmark.fill" size={20} color={colors.icon} />
              <AppText style={[styles.menuText, { color: colors.text, fontFamily: Fonts?.sans }]}>Saved Activities</AppText>
            </TouchableOpacity>

            <View style={[styles.divider, { backgroundColor: colors.outlineVariant }]} />

            <TouchableOpacity style={styles.menuItem} onPress={handleEditPress}>
              <IconSymbol name="person.fill" size={20} color={colors.icon} />
              <AppText style={[styles.menuText, { color: colors.text, fontFamily: Fonts?.sans }]}>Edit Profile</AppText>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={confirmReset} disabled={sendingReset}>
              <AppText style={[styles.menuText, { color: colors.text, fontFamily: Fonts?.sans }]}>
                {sendingReset ? 'Sending…' : 'Reset Password'}
              </AppText>
            </TouchableOpacity>

            <View style={[styles.divider, { backgroundColor: colors.outlineVariant }]} />

            <TouchableOpacity style={styles.menuItem} onPress={handleSignOut}>
              <AppText style={[styles.menuText, { color: colors.error, fontFamily: Fonts?.sans }]}>Sign Out</AppText>
            </TouchableOpacity>
          </Animated.View>
          <Pressable style={styles.overlay} onPress={onClose} />
        </View>
      </Modal>

      {profile && (
        <EditProfileSheet
          visible={editSheetVisible}
          onClose={() => setEditSheetVisible(false)}
          userId={profile.id}
          initialName={profile.full_name ?? ''}
          initialUniversity={profile.university ?? ''}
          initialMajor={profile.major ?? ''}
          initialAvatar={profile.profile_picture}
          onSaved={() => { void refreshProfile(); }}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sidebar: {
    width: SIDEBAR_WIDTH,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 3, height: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 10,
  },
  profileSection: {
    paddingBottom: 20,
    gap: 4,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginBottom: 10,
  },
  name: {
    fontSize: 17,
    fontWeight: '700',
  },
  email: {
    fontSize: 13,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
  },
  menuText: {
    fontSize: 16,
    fontWeight: '500',
  },
});
