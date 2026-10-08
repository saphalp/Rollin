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
import InfoCard from '@/components/profile/InfoCard';
import StatusPill from '@/components/profile/StatusPill';
import StepProgressBar from '@/components/profile/StepProgressBar';
import VerifiedBadge from '@/components/profile/VerifiedBadge';
import { AppText } from '@/components/text';
import { IconSymbol } from '@/components/ui/icon-symbol';
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

    getDriverProfile()
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
    const driverValues = {
      vehicleMake,
      vehicleModel,
      vehicleYear,
      vehicleColor,
      licensePlateNumber,
    };

    const driverError = validateDriverFields(driverValues);

    if (driverError) {
      Alert.alert('Missing info', driverError);
      return;
    }

    setVerifying(true);
    try {
      await upsertDriverProfile(driverValues);
      await startLicenseVerification();

      const row = await getDriverProfile();
      setVerificationStatus(row?.verification_status ?? 'pending');
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

      if (!verificationStatus) {
        Alert.alert(
          'Verify your license',
          'Please verify your license before finishing, or clear the vehicle fields to skip driver registration.'
        );
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
          {step === 2 ? (
            <TouchableOpacity
              onPress={() => setStep(1)}
              disabled={saving || verifying}
              hitSlop={10}
            >
              <IconSymbol name="chevron.left" size={24} color={colors.text} />
            </TouchableOpacity>
          ) : (
            <AppText style={[styles.headerTitle, { color: colors.text, fontFamily: Fonts?.sans }]}>
              Edit Profile
            </AppText>
          )}
          <TouchableOpacity onPress={onClose} hitSlop={10}>
            <IconSymbol name="xmark.circle.fill" size={24} color={colors.outline} />
          </TouchableOpacity>
        </View>

        <View style={styles.progressWrapper}>
          <StepProgressBar
            currentStep={step}
            totalSteps={2}
            stepLabels={['Personal Details', 'Driver & Vehicle']}
          />
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
              <View style={styles.stepContainer}>
                <BasicInfoCard
                  {...basicInfo}
                  title="Your Info"
                  subtitle="Update your name, university, and major."
                  nextLabel="Next: Driver Registration"
                  onNext={(values) => {
                    setBasicInfo(values);
                    setStep(2);
                  }}
                />
              </View>
            )}

            {step === 2 && (
              <View style={styles.stepContainer}>
                <AppText style={[styles.driverTitle, { color: colors.text, fontFamily: Fonts?.sans }]}>
                  Register as Driver
                </AppText>

                <InfoCard
                  icon="car.fill"
                  accent="secondary"
                  title="Offer Rides, Build Trust"
                  text="Optional. Add your vehicle and verify your license so other students know they're riding with someone verified."
                />

                <View
                  style={[
                    styles.card,
                    { backgroundColor: colors.cardBackground, borderColor: colors.outlineVariant },
                  ]}
                >
                  <View style={styles.cardHeading}>
                    <AppText style={[styles.cardTitle, { color: colors.text, fontFamily: Fonts?.sans }]}>
                      Vehicle Details
                    </AppText>
                    <AppText style={[styles.cardSubtitle, { color: colors.icon, fontFamily: Fonts?.sans }]}>
                      Helps other students spot your car
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
                    disabled={saving || verifying}
                  />
                </View>

                <View
                  style={[
                    styles.card,
                    { backgroundColor: colors.cardBackground, borderColor: colors.outlineVariant },
                  ]}
                >
                  <View style={styles.cardHeadingRow}>
                    <AppText style={[styles.cardTitle, { color: colors.text, fontFamily: Fonts?.sans }]}>
                      License &amp; Safety Check
                    </AppText>
                    <StatusPill
                      label={verificationStatus === 'verified' ? 'Verified' : 'Action Required'}
                      tone={verificationStatus === 'verified' ? 'success' : 'warning'}
                    />
                  </View>

                  <AppText style={[styles.cardDescription, { color: colors.icon, fontFamily: Fonts?.sans }]}>
                    We partner with Didit for instant credential verification. Your documents are
                    only used to confirm your license and are never shown to other riders.
                  </AppText>

                  {verificationStatus === 'verified' ? (
                    <VerifiedBadge />
                  ) : (
                    <Button
                      mode="outlined"
                      onPress={handleVerifyLicense}
                      loading={verifying}
                      disabled={saving || verifying}
                      textColor={colors.tint}
                      style={[styles.verifyButton, { borderColor: colors.tint }]}
                      contentStyle={styles.finishButtonContent}
                    >
                      Verify License via Secure Portal
                    </Button>
                  )}
                </View>

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
                  Save &amp; Complete Profile
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

  progressWrapper: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },

  keyboardView: {
    flex: 1,
  },

  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 40,
    gap: 24,
  },

  stepContainer: {
    gap: 20,
  },

  driverTitle: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '700',
    textAlign: 'center',
  },

  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    gap: 14,
  },

  cardHeading: {
    gap: 2,
  },

  cardHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
  },

  cardSubtitle: {
    fontSize: 12,
  },

  cardDescription: {
    fontSize: 13,
    lineHeight: 19,
  },

  verifyButton: {
    borderRadius: 14,
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
