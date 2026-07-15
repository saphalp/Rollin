import { useState } from "react";
import { Alert, ScrollView, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import AvatarCard from "@/components/profile/AvatarCard";
import ProfileInfo from "@/components/profile/ProfileInfo";
import ProfileStats from "@/components/profile/ProfileStats";
import { AppView } from "@/components/view";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

type ProfileSnapshot = {
  fullName: string;
  age: string;
  email: string;
  phone: string;
  gender: string;
};

export default function ProfileScreen() {
  const theme = useColorScheme() ?? "light";
  const colors = Colors[theme];
  const insets = useSafeAreaInsets();

  const [isEditing, setIsEditing] = useState(false);

  const [fullName, setFullName] = useState("Saphal Pant");
  const [age, setAge] = useState("");
  const [email, setEmail] = useState("saphal@pant.com");
  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState("");
  const [originalProfile, setOriginalProfile] =
    useState<ProfileSnapshot | null>(null);

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
    Alert.alert("Profile saved", "Your profile information has been updated.");
  }

  return (
    <AppView style={styles.container}>
      <ScrollView
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 8 }]}
        showsVerticalScrollIndicator={false}
      >
        <AvatarCard
          avatarImg={{
            uri: "https://imageio.forbes.com/specials-images/imageserve/663e595b4509f97fdafb95f5/0x0.jpg?format=jpg&crop=383,383,x1045,y23,safe&height=416&width=416&fit=bounds",
          }}
          verified
        />
        <ProfileInfo
          name="Saphal Pant"
          university="Louisana Tech University"
          major="Computer Science"
        />
        <ProfileStats
          statsData={{
            attended: 4,
            hosted: 10,
            rides: 12,
            rating: 4.5,
          }}
        />
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
  },
  editButton: {
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: "700",
  },
  profileCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 18,
    alignItems: "center",
    gap: 12,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  profileSummary: {
    alignItems: "center",
    gap: 4,
  },
  name: {
    fontSize: 22,
    fontWeight: "700",
  },
  email: {
    fontSize: 14,
  },
  section: {
    gap: 14,
  },
  sectionHeading: {
    fontSize: 18,
    fontWeight: "700",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
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
    fontWeight: "700",
  },
});
