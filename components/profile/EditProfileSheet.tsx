import { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Button } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import BasicInfoCard, { BasicInfoValues } from '@/components/profile/BasicInfoCard';
import DriverVehicleFields from '@/components/profile/DriverVehicleFields';
import { AppText } from '@/components/text';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getDriverProfile, upsertDriverProfile } from '@/lib/profile/driver-profile';
import { startLicenseVerification } from '@/lib/profile/driver-verification';
import { supabase } from '@/lib/supabase';
import { isDriverFieldsEmpty, validateDriverFields } from '@/lib/profile/validate-driver-fields';

type Props = {
  visible: boolean;
  onClose: () => void;
  userId: string;
  initialName: string;
  initialUniversity: string;
  initialMajor: string;
  onSaved: () => void;
};

export function EditProfileSheet({
  visible,
  onClose,
  userId,
  initialName,
  initialUniversity,
  initialMajor,
  onSaved,
}: Props) {
  const theme = useColorScheme() ?? 'light';
  const colors = Colors[theme];

  const [step, setStep] = useState<1 | 2>(1);
  const [basicInfo, setBasicInfo] = useState<BasicInfoValues>({
    fullName: initialName,
    university: initialUniversity,
    major: initialMajor,
  });

  const [verificationStatus, setVerificationStatus] = useState<string | null>(null);
  const [vehicleMake, setVehicleMake] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleYear, setVehicleYear] = useState('');
  const [vehicleColor, setVehicleColor] = useState('');
  const [licensePlateNumber, setLicensePlateNumber] = useState('');

  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    if (!visible) return;

    setStep(1);
    setBasicInfo({
      fullName: initialName,
      university: initialUniversity,
      major: initialMajor,
    });

    let active = true;

    getDriverProfile(userId)
      .then((row) => {
        if (!active) return;

        setVerificationStatus(row?.verification_status ?? null);
        setVehicleMake(row?.vehicle_make ?? '');
        setVehicleModel(row?.vehicle_model ?? '');
        setVehicleYear(row ? String(row.vehicle_year) : '');
        setVehicleColor(row?.vehicle_color ?? '');
        setLicensePlateNumber(row?.license_plate_number ?? '');
      })
      .catch((err) => console.error('Unable to load driver profile:', err));

    return () => {
      active = false;
    };
  }, [visible, userId, initialName, initialUniversity, initialMajor]);

  async function handleVerifyLicense() {
    setVerifying(true);
    try {
      await startLicenseVerification();

      const row = await getDriverProfile(userId);
      setVerificationStatus(row?.verification_status ?? null);
    } catch (err: any) {
      Alert.alert('Verification failed', err?.message ?? 'Please try again.');
    } finally {
      setVerifying(false);
    }
  }

  async function handleFinish() {
    const driverValues = {
      vehicleMake,
      vehicleModel,
      vehicleYear,
      vehicleColor,
      licensePlateNumber,
    };

    const hasDriverInfo = !isDriverFieldsEmpty(driverValues);

    if (hasDriverInfo) {
      const driverError = validateDriverFields(driverValues);

      if (driverError) {
        Alert.alert('Missing info', driverError);
        return;
      }
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: basicInfo.fullName.trim(),
          university: basicInfo.university.trim(),
          major: basicInfo.major.trim(),
        })
        .eq('id', userId);

      if (error) throw error;

      if (hasDriverInfo) {
        await upsertDriverProfile(driverValues);
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
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <AppText style={[styles.headerTitle, { color: colors.text, fontFamily: Fonts?.sans }]}>
            Edit Profile
          </AppText>
          <TouchableOpacity onPress={onClose} hitSlop={10}>
            <AppText style={[styles.cancel, { color: colors.outline, fontFamily: Fonts?.sans }]}>Cancel</AppText>
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {step === 1 && (
              <BasicInfoCard
                {...basicInfo}
                title="Your Info"
                subtitle="Update your name, university, and major."
                onNext={(values) => {
                  setBasicInfo(values);
                  setStep(2);
                }}
              />
            )}

            {step === 2 && (
              <View style={styles.driverStep}>
                <View style={styles.driverHeading}>
                  <AppText style={[styles.driverTitle, { color: colors.text, fontFamily: Fonts?.sans }]}>
                    Register as Driver
                  </AppText>
                  <AppText style={[styles.driverSubtitle, { color: colors.icon, fontFamily: Fonts?.sans }]}>
                    Optional. Add your vehicle so you can offer rides.
                    {verificationStatus ? ` Status: ${verificationStatus}.` : ''}
                  </AppText>
                </View>

                <DriverVehicleFields
                  vehicleMake={vehicleMake}
                  vehicleModel={vehicleModel}
                  vehicleYear={vehicleYear}
                  vehicleColor={vehicleColor}
                  licensePlateNumber={licensePlateNumber}
                  onChangeVehicleMake={setVehicleMake}
                  onChangeVehicleModel={setVehicleModel}
                  onChangeVehicleYear={setVehicleYear}
                  onChangeVehicleColor={setVehicleColor}
                  onChangeLicensePlateNumber={setLicensePlateNumber}
                  disabled={saving}
                />

                {verificationStatus && verificationStatus !== 'verified' && (
                  <Button
                    mode="outlined"
                    onPress={handleVerifyLicense}
                    loading={verifying}
                    disabled={verifying || saving}
                  >
                    Verify License
                  </Button>
                )}

                <Button onPress={() => setStep(1)} disabled={saving || verifying} textColor={colors.icon}>
                  Back
                </Button>

                <Button
                  mode="contained"
                  onPress={handleFinish}
                  loading={saving}
                  disabled={saving || verifying}
                  buttonColor={colors.tint}
                  textColor={colors.onPrimary}
                  contentStyle={styles.finishButtonContent}
                  style={styles.finishButton}
                  labelStyle={styles.finishButtonLabel}
                >
                  Finish
                </Button>
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },

  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },

  cancel: {
    fontSize: 15,
  },

  keyboardView: {
    flex: 1,
  },

  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 40,
    gap: 24,
  },

  driverStep: {
    gap: 24,
  },

  driverHeading: {
    alignItems: 'center',
    gap: 8,
  },

  driverTitle: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
    textAlign: 'center',
  },

  driverSubtitle: {
    maxWidth: 320,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    alignSelf: 'center',
  },

  finishButton: {
    borderRadius: 14,
    marginTop: 'auto',
  },

  finishButtonContent: {
    height: 54,
  },

  finishButtonLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
});
