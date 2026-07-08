import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ProfileField } from '@/components/profile/profile-field';
import { AppText } from '@/components/text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { AppView } from '@/components/view';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type ProfileSnapshot = {
  fullName: string;
  age: string;
  email: string;
  phone: string;
  gender: string;
};

export default function ProfileScreen() {
  const theme = useColorScheme() ?? 'light';
  const colors = Colors[theme];
  const insets = useSafeAreaInsets();

  const [isEditing, setIsEditing] = useState(false);

  const [fullName, setFullName] = useState('Saphal Pant');
  const [age, setAge] = useState('');
  const [email, setEmail] = useState('saphal@pant.com');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState('');
  const [originalProfile, setOriginalProfile] = useState<ProfileSnapshot | null>(null);

  function handleEdit() {
    setOriginalProfile({
      fullName,
      age,
      email,
      phone,
      gender,
    });

    setIsEditing(true);
  }

  function handleCancel() {
    if (originalProfile) {
      setFullName(originalProfile.fullName);
      setAge(originalProfile.age);
      setEmail(originalProfile.email);
      setPhone(originalProfile.phone);
      setGender(originalProfile.gender);
    }

    setOriginalProfile(null);
    setIsEditing(false);
  }

  function handleSave() {
    setOriginalProfile(null);
    setIsEditing(false);
    Alert.alert('Profile saved', 'Your profile information has been updated.');
  }

  return (
    <AppView style={styles.container}>
      <ScrollView
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 8 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <AppText style={[styles.title, { color: colors.text, fontFamily: Fonts?.sans }]}>
            Profile
          </AppText>

          <View style={styles.headerActions}>
            {isEditing && (
              <TouchableOpacity
                onPress={handleCancel}
                style={[
                  styles.cancelButton,
                  {
                    borderColor: colors.outlineVariant,
                    backgroundColor: colors.cardBackground,
                  },
                ]}
              >
                <AppText
                  style={[
                    styles.cancelButtonText,
                    {
                      color: colors.text,
                      fontFamily: Fonts?.sans,
                    },
                  ]}
                >
                  Cancel
                </AppText>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={isEditing ? handleSave : handleEdit}
              style={[
                styles.editButton,
                {
                  backgroundColor: colors.tint,
                },
              ]}
            >
              <AppText
                style={[
                  styles.editButtonText,
                  {
                    color: colors.onImageOverlay,
                    fontFamily: Fonts?.sans,
                  },
                ]}
              >
                {isEditing ? 'Save' : 'Edit'}
              </AppText>
            </TouchableOpacity>
          </View>
        </View>

        <View
          style={[
            styles.profileCard,
            {
              backgroundColor: colors.cardBackground,
              borderColor: colors.outlineVariant,
            },
          ]}
        >
          <View style={[styles.avatar, { backgroundColor: colors.primaryContainer }]}>
            <IconSymbol name="person.fill" size={38} color={colors.tint} />
          </View>

          <View style={styles.profileSummary}>
            <AppText style={[styles.name, { color: colors.text, fontFamily: Fonts?.sans }]}>
              {fullName || 'Your Name'}
            </AppText>

            <AppText style={[styles.email, { color: colors.outline, fontFamily: Fonts?.sans }]}>
              {email || 'your.email@example.com'}
            </AppText>
          </View>
        </View>

        <View style={styles.section}>
          <AppText style={[styles.sectionHeading, { color: colors.text, fontFamily: Fonts?.sans }]}>
            Personal Information
          </AppText>

          <ProfileField
            label="Full Name"
            value={fullName}
            onChangeText={setFullName}
            editable={isEditing}
            placeholder="Enter your full name"
          />

          <ProfileField
            label="Age"
            value={age}
            onChangeText={setAge}
            editable={isEditing}
            placeholder="Enter your age"
            keyboardType="numeric"
          />

          <ProfileField
            label="Email"
            value={email}
            onChangeText={setEmail}
            editable={isEditing}
            placeholder="Enter your email"
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <ProfileField
            label="Phone Number"
            value={phone}
            onChangeText={setPhone}
            editable={isEditing}
            placeholder="Enter your phone number"
            keyboardType="phone-pad"
          />

          <ProfileField
            label="Gender"
            value={gender}
            onChangeText={setGender}
            editable={isEditing}
            placeholder="Enter your gender"
          />
        </View>
      </ScrollView>
    </AppView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 18,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
  editButton: {
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  profileCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 18,
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileSummary: {
    alignItems: 'center',
    gap: 4,
  },
  name: {
    fontSize: 22,
    fontWeight: '700',
  },
  email: {
    fontSize: 14,
  },
  section: {
    gap: 14,
  },
  sectionHeading: {
    fontSize: 18,
    fontWeight: '700',
  },
headerActions: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 8,
},
cancelButton: {
  borderWidth: 1,
  borderRadius: 20,
  paddingHorizontal: 18,
  paddingVertical: 8,
},
cancelButtonText: {
  fontSize: 14,
  fontWeight: '700',
},
});