import { useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { Button } from 'react-native-paper';

import type { BasicInfoValues } from '@/components/profile/BasicInfoCard';
import DriverVehicleFields from '@/components/profile/DriverVehicleFields';
import EditProfileShell from '@/components/profile/EditProfileShell';
import InfoCard from '@/components/profile/InfoCard';
import StatusPill from '@/components/profile/StatusPill';
import VerifiedBadge from '@/components/profile/VerifiedBadge';
import { AppText } from '@/components/text';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getDriverProfile, upsertDriverProfile } from '@/lib/profile/driver-profile';
import { startLicenseVerification } from '@/lib/profile/driver-verification';
import { isDriverFieldsEmpty, validateDriverFields } from '@/lib/profile/validate-driver-fields';
import { supabase } from '@/lib/supabase';
import { getCurrentUniversity } from '@/lib/university';

type Props = {
  userId: string;
  /** Personal details collected on the first page; saved together with the driver info. */
  basicInfo: BasicInfoValues;
  onSaved: () => void | Promise<void>;
};

export default function EditProfileDriverStep({ userId, basicInfo, onSaved }: Props) {
  const theme = useColorScheme() ?? 'light';
  const colors = Colors[theme];

  const [verificationStatus, setVerificationStatus] = useState<string | null>(null);
  const [vehicleMake, setVehicleMake] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleYear, setVehicleYear] = useState('');
  const [vehicleColor, setVehicleColor] = useState('');
  const [licensePlateNumber, setLicensePlateNumber] = useState('');

  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
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
  }, [userId]);

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
      // Never trust the university passed through navigation parameters.
      // A recognized, verified campus email takes precedence over user input.
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!auth.user || auth.user.id !== userId) {
        throw new Error('Your session has changed. Please sign in again.');
      }
      if (!basicInfo.fullName.trim() || !basicInfo.major.trim()) {
        throw new Error('Name and major are required.');
      }

      const assignedUniversity = await getCurrentUniversity();
      let selectedUniversity: string;
      if (assignedUniversity) {
        selectedUniversity = assignedUniversity.name;
      } else {
        // Personal-email users can skip university or choose a real directory entry.
        const requestedName = basicInfo.university.trim();
        if (!requestedName) {
          selectedUniversity = ''; // Empty string represents skipped university in existing profile schema.
        } else {
          const { data: option, error: universityError } = await supabase
            .from('university_directory')
            .select('name')
            .eq('name', requestedName)
            .maybeSingle();
          if (universityError) throw universityError;
          if (!option) throw new Error('Please select a university from the list.');
          selectedUniversity = option.name;
        }
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: basicInfo.fullName.trim(),
          university: selectedUniversity,
          major: basicInfo.major.trim(),
        })
        .eq('id', userId);

      if (error) throw error;

      if (hasDriverInfo) {
        await upsertDriverProfile(driverValues);
      }

      await onSaved();
    } catch (err: any) {
      Alert.alert('Save failed', err?.message ?? 'Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <EditProfileShell step={2} busy={saving || verifying}>
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
    </EditProfileShell>
  );
}

const styles = StyleSheet.create({
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
