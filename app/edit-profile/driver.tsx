import { Redirect, router, useLocalSearchParams } from 'expo-router';

import EditProfileDriverStep from '@/components/profile/EditProfileDriverStep';
import { useAuthContext } from '@/hooks/use-auth-context';

/** Edit Profile, step 2: driver & vehicle. Saves both steps, then closes the whole flow. */
export default function EditProfileDriverScreen() {
  const { profile, refreshProfile } = useAuthContext();
  const { fullName, university, major } = useLocalSearchParams<{
    fullName?: string;
    university?: string;
    major?: string;
  }>();

  // Opened without step 1's values (e.g. a reload on this page): restart the flow.
  if (!profile || !fullName || !university || !major) {
    return <Redirect href="/edit-profile" />;
  }

  return (
    <EditProfileDriverStep
      userId={profile.id}
      basicInfo={{ fullName, university, major }}
      onSaved={async () => {
        await refreshProfile();
        // Pop both Edit Profile pages to return wherever the flow was opened from.
        router.dismiss(2);
      }}
    />
  );
}
