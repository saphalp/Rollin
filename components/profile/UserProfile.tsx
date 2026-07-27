import { Colors, Fonts } from "@/constants/theme";
import { useFollow } from "@/hooks/use-follow";
import { useProfile } from "@/hooks/use-profile";
import { supabase } from "@/lib/supabase";
import { router } from "expo-router";
import { useEffect, useState } from "react";
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
import ProfileAvatar from "@/components/profile/ProfileAvatar";
import ProfileInfo from "@/components/profile/ProfileInfo";
import ProfileStats from "@/components/profile/ProfileStats";
import SectionHeader from "@/components/profile/SectionHeader";

const FALLBACK_AVATAR =
  "https://ui-avatars.com/api/?background=e0e0e0&color=666&name=?";

const EMPTY_STATS = { attended: 0, hosted: 0, rides: 0, rating: 0 };

const PLACEHOLDER_INTERESTS: string[] = [];

type ActivityRow = {
  id: string;
  title: string;
  date: string;
  time: string;
  imageUri: string;
};

const CATEGORY_FALLBACK_IMAGE: Record<string, string> = {
  social: "https://picsum.photos/seed/social/240/240",
  sports: "https://picsum.photos/seed/sports/240/240",
  music: "https://picsum.photos/seed/music/240/240",
  study: "https://picsum.photos/seed/study/240/240",
  outdoor: "https://picsum.photos/seed/outdoor/240/240",
  gaming: "https://picsum.photos/seed/gaming/240/240",
  grocery: "https://picsum.photos/seed/grocery/240/240",
};

function resolveAvatarUri(profilePicture: string | null | undefined): string {
  if (!profilePicture) return FALLBACK_AVATAR;
  if (profilePicture.startsWith("http")) return profilePicture;
  return supabase.storage.from("avatars").getPublicUrl(profilePicture).data
    .publicUrl;
}

function formatActivityDate(iso: string | null): string {
  if (!iso) return "Date TBD";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatActivityTime(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

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
  const [activities, setActivities] = useState<ActivityRow[]>([]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    (async () => {
      const { data, error } = await supabase
        .from("activities")
        .select("id, title, date_time, image_url, category")
        .eq("host_id", userId)
        .order("date_time", { ascending: false })
        .limit(10);

      if (cancelled) return;
      if (error) {
        console.error("[profile] fetch activities failed:", error);
        setActivities([]);
        return;
      }

      setActivities(
        (data ?? []).map((a: any) => ({
          id: a.id,
          title: a.title,
          date: formatActivityDate(a.date_time),
          time: formatActivityTime(a.date_time),
          imageUri:
            a.image_url ||
            CATEGORY_FALLBACK_IMAGE[a.category as string] ||
            CATEGORY_FALLBACK_IMAGE.social,
        })),
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

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
  const avatarUri = resolveAvatarUri(profile.profile_picture);
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
        {isOwnProfile ? (
          <ProfileAvatar verified={verified} editable />
        ) : (
          <AvatarCard avatarImg={{ uri: avatarUri }} verified={verified} />
        )}

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
            {activities.length === 0 ? (
              <Text
                style={{
                  color: colors.icon,
                  fontFamily: Fonts.sans,
                  fontSize: 14,
                  paddingTop: 15,
                }}
              >
                {isOwnProfile
                  ? "You haven't posted an activity yet."
                  : "No activities yet."}
              </Text>
            ) : (
              activities.map((activity) => (
                <MyActivities
                  key={activity.id}
                  title={activity.title}
                  date={activity.date}
                  time={activity.time}
                  image={{ uri: activity.imageUri }}
                  onPress={() => router.push(`/activity/${activity.id}`)}
                />
              ))
            )}
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
