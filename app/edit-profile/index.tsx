import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import BasicInfoCard from '@/components/profile/BasicInfoCard';
import EditProfileShell from '@/components/profile/EditProfileShell';
import { useAuthContext } from '@/hooks/use-auth-context';

/** Edit Profile, step 1: personal details. Values are carried to the driver page and saved there. */
export default function EditProfileScreen() {
  const { profile } = useAuthContext();

  return (
    <EditProfileShell step={1}>
      <View style={styles.stepContainer}>
        <BasicInfoCard
          fullName={profile?.full_name ?? ''}
          university={profile?.university ?? ''}
          major={profile?.major ?? ''}
          title="Your Info"
          subtitle="Update your name, university, and major."
          nextLabel="Next: Driver Registration"
          onNext={(values) => router.push({ pathname: '/edit-profile/driver', params: values })}
        />
      </View>
    </EditProfileShell>
  );
}

const styles = StyleSheet.create({
  stepContainer: {
    gap: 20,
  },
});
