import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Modal, Pressable, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/text';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { supabase } from '@/lib/supabase';

type Props = {
  visible: boolean;
  onClose: () => void;
  email: string;
  onEditPress: () => void;
};

const SIDEBAR_WIDTH = 260;

export function ProfileSettingsSidebar({ visible, onClose, email, onEditPress }: Props) {
  const theme = useColorScheme() ?? 'light';
  const colors = Colors[theme];
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(SIDEBAR_WIDTH)).current;
  const [signingOut, setSigningOut] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: visible ? 0 : SIDEBAR_WIDTH,
      useNativeDriver: true,
      tension: 65,
      friction: 9,
    }).start();
  }, [visible]);

  function navigate(path: string) {
    onClose();
    router.push(path as any);
  }

  function handleEditPress() {
    onClose();
    onEditPress();
  }

  function confirmSignOut() {
    Alert.alert('Log out?', 'You will need to sign in again to access your account.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: signOut },
    ]);
  }

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    const { error } = await supabase.auth.signOut();
    if (error) {
      Alert.alert('Unable to log out', 'Please check your connection and try again.');
      setSigningOut(false);
    }
    onClose();
  }

  function confirmReset() {
    Alert.alert('Reset password?', `We'll send a password reset code to ${email}.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Send Code', onPress: sendResetCode },
    ]);
  }

  async function sendResetCode() {
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
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.container}>
        <Pressable style={styles.overlay} onPress={onClose} />
        <Animated.View
          style={[
            styles.sidebar,
            { backgroundColor: colors.cardBackground, paddingTop: insets.top + 20 },
            { transform: [{ translateX: slideAnim }] },
          ]}
        >
          <AppText style={[styles.heading, { color: colors.text, fontFamily: Fonts?.sans }]}>
            Settings
          </AppText>

          <View style={[styles.divider, { backgroundColor: colors.outlineVariant }]} />

          <TouchableOpacity style={styles.item} onPress={handleEditPress}>
            <AppText style={[styles.itemText, { color: colors.text, fontFamily: Fonts?.sans }]}>Edit Profile</AppText>
          </TouchableOpacity>

          <TouchableOpacity style={styles.item} onPress={() => navigate('/saved-activities')}>
            <AppText style={[styles.itemText, { color: colors.text, fontFamily: Fonts?.sans }]}>Saved Activities</AppText>
          </TouchableOpacity>

          <View style={[styles.divider, { backgroundColor: colors.outlineVariant }]} />

          <TouchableOpacity style={styles.item} onPress={confirmReset} disabled={sendingReset}>
            <AppText style={[styles.itemText, { color: colors.text, fontFamily: Fonts?.sans }]}>
              {sendingReset ? 'Sending…' : 'Reset Password'}
            </AppText>
          </TouchableOpacity>

          <View style={[styles.divider, { backgroundColor: colors.outlineVariant }]} />

          <TouchableOpacity style={styles.item} onPress={confirmSignOut} disabled={signingOut}>
            <AppText style={[styles.itemText, { color: colors.error, fontFamily: Fonts?.sans }]}>
              {signingOut ? 'Signing out…' : 'Log Out'}
            </AppText>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
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
    shadowOffset: { width: -3, height: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 10,
  },
  heading: {
    fontSize: 18,
    fontWeight: '700',
    paddingBottom: 16,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 8,
  },
  item: {
    paddingVertical: 16,
  },
  itemText: {
    fontSize: 16,
    fontWeight: '500',
  },
});
