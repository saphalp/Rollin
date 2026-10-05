import type { ImagePickerAsset } from 'expo-image-picker';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import DriverVehicleFields from '@/components/profile/DriverVehicleFields';
import { AppText } from '@/components/text';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getDriverProfile, upsertDriverProfile } from '@/lib/profile/driver-profile';
import { FALLBACK_AVATAR, resolveAvatarUri } from '@/lib/profile/resolve-avatar-uri';
import { selectProfileImage } from '@/lib/profile/select-profile-image';
import { uploadProfilePicture } from '@/lib/profile/upload-profile-picture';
import { supabase } from '@/lib/supabase';
import { validateDriverFields } from '@/lib/profile/validate-driver-fields';

type Props = {
  visible: boolean;
  onClose: () => void;
  userId: string;
  initialName: string;
  initialUniversity: string;
  initialMajor: string;
  initialAvatar: string | null | undefined;
  onSaved: () => void;
};

export function EditProfileSheet({
  visible,
  onClose,
  userId,
  initialName,
  initialUniversity,
  initialMajor,
  initialAvatar,
  onSaved,
}: Props) {
  const theme = useColorScheme() ?? 'light';
  const colors = Colors[theme];
  const insets = useSafeAreaInsets();

  const [name, setName] = useState(initialName);
  const [university, setUniversity] = useState(initialUniversity);
  const [major, setMajor] = useState(initialMajor);
  const [selectedImage, setSelectedImage] = useState<ImagePickerAsset | null>(null);
  const [saving, setSaving] = useState(false);

  const [showDriverFields, setShowDriverFields] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<string | null>(null);
  const [vehicleMake, setVehicleMake] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleColor, setVehicleColor] = useState('');
  const [licensePlateNumber, setLicensePlateNumber] = useState('');

  const avatarUri = selectedImage?.uri ?? resolveAvatarUri(initialAvatar);

  useEffect(() => {
    if (!visible) return;

    let active = true;

    getDriverProfile(userId)
      .then((row) => {
        if (!active || !row) return;

        setShowDriverFields(true);
        setVerificationStatus(row.verification_status);
        setVehicleMake(row.vehicle_make);
        setVehicleModel(row.vehicle_model);
        setVehicleColor(row.vehicle_color);
        setLicensePlateNumber(row.license_plate_number);
      })
      .catch((err) => console.error('Unable to load driver profile:', err));

    return () => {
      active = false;
    };
  }, [visible, userId]);

  async function handlePickImage() {
    const image = await selectProfileImage();
    if (image) setSelectedImage(image);
  }

  async function handleSave() {
    if (!name.trim()) {
      Alert.alert('Missing info', 'Full name is required.');
      return;
    }

    if (showDriverFields) {
      const driverError = validateDriverFields({
        vehicleMake,
        vehicleModel,
        vehicleColor,
        licensePlateNumber,
      });

      if (driverError) {
        Alert.alert('Missing info', driverError);
        return;
      }
    }

    setSaving(true);
    try {
      if (selectedImage) {
        await uploadProfilePicture(selectedImage);
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: name.trim(),
          university: university.trim(),
          major: major.trim(),
        })
        .eq('id', userId);

      if (error) throw error;

      if (showDriverFields) {
        await upsertDriverProfile({
          vehicleMake,
          vehicleModel,
          vehicleColor,
          licensePlateNumber,
        });
      }

      onSaved();
      onClose();
    } catch (err: any) {
      Alert.alert('Save failed', err?.message ?? 'Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.sheetWrapper}
      >
        <View style={[styles.sheet, { backgroundColor: colors.cardBackground, paddingBottom: insets.bottom + 16 }]}>
          <View style={[styles.handle, { backgroundColor: colors.outlineVariant }]} />

          <View style={styles.header}>
            <AppText style={[styles.title, { color: colors.text, fontFamily: Fonts?.sans }]}>Edit Profile</AppText>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <AppText style={[styles.cancel, { color: colors.outline, fontFamily: Fonts?.sans }]}>Cancel</AppText>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Avatar */}
            <TouchableOpacity style={styles.avatarRow} onPress={handlePickImage} activeOpacity={0.8}>
              <Image
                source={{ uri: avatarUri }}
                style={styles.avatar}
                contentFit="cover"
              />
              <View style={[styles.editBadge, { backgroundColor: colors.tint }]}>
                <AppText style={[styles.editBadgeText, { color: colors.onPrimary, fontFamily: Fonts?.sans }]}>
                  Change Photo
                </AppText>
              </View>
            </TouchableOpacity>

            {/* Fields */}
            <View style={styles.fields}>
              <AppText style={[styles.label, { color: colors.outline, fontFamily: Fonts?.sans }]}>Full Name</AppText>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surfaceContainerHigh, color: colors.text, borderColor: colors.outlineVariant, fontFamily: Fonts?.sans }]}
                value={name}
                onChangeText={setName}
                placeholder="Full Name"
                placeholderTextColor={colors.outline}
              />

              <AppText style={[styles.label, { color: colors.outline, fontFamily: Fonts?.sans }]}>University</AppText>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surfaceContainerHigh, color: colors.text, borderColor: colors.outlineVariant, fontFamily: Fonts?.sans }]}
                value={university}
                onChangeText={setUniversity}
                placeholder="University"
                placeholderTextColor={colors.outline}
              />

              <AppText style={[styles.label, { color: colors.outline, fontFamily: Fonts?.sans }]}>Major</AppText>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surfaceContainerHigh, color: colors.text, borderColor: colors.outlineVariant, fontFamily: Fonts?.sans }]}
                value={major}
                onChangeText={setMajor}
                placeholder="Major"
                placeholderTextColor={colors.outline}
              />
            </View>

            {!showDriverFields ? (
              <TouchableOpacity
                style={[styles.registerDriverRow, { borderColor: colors.outlineVariant }]}
                onPress={() => setShowDriverFields(true)}
                activeOpacity={0.8}
              >
                <View>
                  <AppText style={[styles.registerDriverTitle, { color: colors.text, fontFamily: Fonts?.sans }]}>
                    Register as Driver
                  </AppText>
                  <AppText style={[styles.registerDriverSubtitle, { color: colors.outline, fontFamily: Fonts?.sans }]}>
                    Offer rides to other students
                  </AppText>
                </View>
              </TouchableOpacity>
            ) : (
              <View style={styles.fields}>
                <AppText style={[styles.label, { color: colors.outline, fontFamily: Fonts?.sans }]}>
                  Vehicle Information
                  {verificationStatus ? ` · Status: ${verificationStatus}` : ''}
                </AppText>

                <DriverVehicleFields
                  vehicleMake={vehicleMake}
                  vehicleModel={vehicleModel}
                  vehicleColor={vehicleColor}
                  licensePlateNumber={licensePlateNumber}
                  onChangeVehicleMake={setVehicleMake}
                  onChangeVehicleModel={setVehicleModel}
                  onChangeVehicleColor={setVehicleColor}
                  onChangeLicensePlateNumber={setLicensePlateNumber}
                  disabled={saving}
                />
              </View>
            )}

            <TouchableOpacity
              style={[styles.saveButton, { backgroundColor: colors.tint }, saving && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.85}
            >
              {saving ? (
                <ActivityIndicator color={colors.onPrimary} />
              ) : (
                <AppText style={[styles.saveText, { color: colors.onPrimary, fontFamily: Fonts?.sans }]}>Save</AppText>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheetWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 12,
    maxHeight: '90%',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  cancel: {
    fontSize: 15,
  },
  avatarRow: {
    alignItems: 'center',
    marginBottom: 28,
    gap: 10,
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
  },
  editBadge: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  editBadgeText: {
    fontSize: 13,
    fontWeight: '600',
  },
  fields: {
    gap: 6,
    marginBottom: 24,
  },
  registerDriverRow: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 24,
  },
  registerDriverTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  registerDriverSubtitle: {
    fontSize: 13,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 16,
  },
  saveButton: {
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginBottom: 8,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveText: {
    fontSize: 16,
    fontWeight: '700',
  },
});
