import { Colors, Fonts } from "@/constants/theme";
import { useFollow } from "@/hooks/use-follow";
import { useProfile } from "@/hooks/use-profile";
import { router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  useColorScheme,
  View,
} from "react-native";
import { Chip, Text } from "react-native-paper";

import AvatarCard from "@/components/profile/AvatarCard";
import InterestChips from "@/components/profile/InterestChips";
import InterestPickerSheet from "@/components/profile/InterestPickerSheet";
import MyActivities from "@/components/profile/MyActivities";
import ProfileActionBar from "@/components/profile/ProfileActionBar";
import ProfileInfo from "@/components/profile/ProfileInfo";
import ProfileStats from "@/components/profile/ProfileStats";
import SectionHeader from "@/components/profile/SectionHeader";

const FALLBACK_AVATAR =
  "https://ui-avatars.com/api/?background=e0e0e0&color=666&name=?";

const EMPTY_STATS = { attended: 0, hosted: 0, rides: 0, rating: 0 };

const PLACEHOLDER_INTERESTS: string[] = [];

const PLACEHOLDER_ACTIVITIES: {
  id: string;
  title: string;
  date: string;
  time: string;
  imageUri: string;
}[] = [];

const INTEREST_OPTIONS = [
  "Board Games",
  "Soccer",
  "Study Nights",
  "Basketball",
  "Hiking",
  "Music",
  "Movies",
  "Coding",
  "Cooking",
  "Photography",
  "Gaming",
  "Yoga",
  "Running",
  "Cycling",
  "Concerts",
  "Coffee",
  "Reading",
  "Volunteering",
  "Art",
  "Dance",
];

interface UserProfileProps {
  userId: string;
}

export default function UserProfile({ userId }: UserProfileProps) {
  const theme = useColorScheme() ?? "light";
  const colors = Colors[theme];

  const { profile, isLoading: profileLoading, isOwnProfile } =
    useProfile(userId);
  const { followState, toggle: toggleFollow } = useFollow(userId);

  const [interests, setInterests] = useState<string[]>(PLACEHOLDER_INTERESTS);
  const [pickerVisible, setPickerVisible] = useState(false);

  function handleMessagePress() {
    if (!profile) return;
    router.push({
      pathname: "/chat/[id]",
      params: {
        id: profile.id,
        name: profile.full_name ?? "",
        avatar: profile.profile_picture ?? FALLBACK_AVATAR,
      },
    });
  }

  function handleEditPress() {
    // TODO: open edit-profile modal / sheet
  }

  if (profileLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.tint} />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.center}>
        <Text style={{ color: colors.text, fontFamily: Fonts.sans }}>
          Profile not found
        </Text>
      </View>
    );
  }

  const name = profile.full_name || "Complete your profile";
  const avatarUri = profile.profile_picture || FALLBACK_AVATAR;
  const verified = !!profile.is_educational_email;
  const university = profile.university || "";
  const major = profile.major || "";

  return (
    <>
      <ScrollView
        style={{ backgroundColor: colors.background, paddingTop: 25 }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <AvatarCard avatarImg={{ uri: avatarUri }} verified={verified} />

        <ProfileInfo name={name} university={university} major={major} />

        <ProfileActionBar
          isOwnProfile={isOwnProfile}
          followState={followState}
          onEditPress={handleEditPress}
          onFollowPress={toggleFollow}
          onMessagePress={handleMessagePress}
        />

        <ProfileStats statsData={EMPTY_STATS} />

        <View>
          <SectionHeader header="Interests" />
          <View style={styles.chipsRow}>
            {interests.map((interest, key) => (
              <InterestChips label={interest} key={key} />
            ))}
            {isOwnProfile && (
              <Chip
                onPress={() => setPickerVisible(true)}
                style={{
                  backgroundColor: colors.background,
                  borderStyle: "dashed",
                  borderWidth: 2,
                  borderColor: colors.icon,
                }}
              >
                +
              </Chip>
            )}
          </View>
        </View>

        <View>
          <SectionHeader
            header={isOwnProfile ? "My Activities" : "Recent Activities"}
          />
          <View style={styles.activitiesList}>
            {PLACEHOLDER_ACTIVITIES.map((activity) => (
              <MyActivities
                key={activity.id}
                title={activity.title}
                date={activity.date}
                time={activity.time}
                image={{ uri: activity.imageUri }}
              />
            ))}
          </View>
        </View>
      </ScrollView>

      {isOwnProfile && (
        <InterestPickerSheet
          visible={pickerVisible}
          onClose={() => setPickerVisible(false)}
          currentInterests={interests}
          options={INTEREST_OPTIONS}
          onSave={(next) => {
            setInterests(next);
            setPickerVisible(false);
          }}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 25,
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingTop: 15,
  },
  activitiesList: {
    gap: 12,
    paddingTop: 15,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
});
