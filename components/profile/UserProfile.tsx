import { Colors, Fonts } from "@/constants/theme";
import { useFollow } from "@/hooks/use-follow";
import { useProfile } from "@/hooks/use-profile";
import { useProfileInterests } from "@/hooks/use-profile-interests";
import { resolveAvatarUri } from "@/lib/profile/resolve-avatar-uri";
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
import ActivitySegmentedControl, {
  type ActivityView,
} from "@/components/profile/ActivitySegmentedControl";
import LogoutButton from "@/components/auth/LogoutButton";
import InterestChips from "@/components/profile/InterestChips";
import InterestPickerSheet from "@/components/profile/InterestPickerSheet";
import MyActivities from "@/components/profile/MyActivities";
import ProfileActionBar from "@/components/profile/ProfileActionBar";
import ProfileAvatar from "@/components/profile/ProfileAvatar";
import ProfileInfo from "@/components/profile/ProfileInfo";
import ProfileStats from "@/components/profile/ProfileStats";
import SectionHeader from "@/components/profile/SectionHeader";

const EMPTY_STATS = { attended: 0, hosted: 0, rides: 0, rating: 0 };

type ActivityRow = {
  id: string;
  title: string;
  date: string;
  time: string;
  imageUri: string;
  dateTime: string | null;
};

type ActivityRecord = {
  id: string;
  title: string;
  date_time: string | null;
  image_url: string | null;
  category: string | null;
};

type JoinedActivityRecord = {
  activity: ActivityRecord | ActivityRecord[] | null;
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

function toActivityRow(activity: ActivityRecord): ActivityRow {
  return {
    id: activity.id,
    title: activity.title,
    date: formatActivityDate(activity.date_time),
    time: formatActivityTime(activity.date_time),
    imageUri:
      activity.image_url ||
      CATEGORY_FALLBACK_IMAGE[activity.category ?? ""] ||
      CATEGORY_FALLBACK_IMAGE.social,
    dateTime: activity.date_time,
  };
}

function sortActivitiesByDate(activities: ActivityRow[]): ActivityRow[] {
  return [...activities].sort((a, b) => {
    if (!a.dateTime) return 1;
    if (!b.dateTime) return -1;
    return new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime();
  });
}

interface UserProfileProps {
  userId: string;
}

export default function UserProfile({ userId }: UserProfileProps) {
  const theme = useColorScheme() ?? "light";
  const colors = Colors[theme];

  const { profile, isLoading: profileLoading, isOwnProfile } =
    useProfile(userId);
  const { followState, toggle: toggleFollow } = useFollow(userId);
  const { allInterestNames, selectedNames, save: saveInterests } =
    useProfileInterests(userId);

  const [pickerVisible, setPickerVisible] = useState(false);
  const [activityView, setActivityView] =
    useState<ActivityView>("created");
  const [createdActivities, setCreatedActivities] = useState<ActivityRow[]>([]);
  const [joinedActivities, setJoinedActivities] = useState<ActivityRow[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(true);
  const [activitiesError, setActivitiesError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    (async () => {
      setActivitiesLoading(true);
      setActivitiesError(null);

      const createdRequest = supabase
        .from("activities")
        .select("id, title, date_time, image_url, category")
        .eq("host_id", userId)
        .order("date_time", { ascending: false });

      const joinedRequest = isOwnProfile
        ? supabase
            .from("rsvps")
            .select(
              "activity:activities(id, title, date_time, image_url, category)",
            )
            .eq("user_id", userId)
        : Promise.resolve({ data: [], error: null });

      const [createdResult, joinedResult] = await Promise.all([
        createdRequest,
        joinedRequest,
      ]);

      if (cancelled) return;

      if (createdResult.error || joinedResult.error) {
        const error = createdResult.error ?? joinedResult.error;
        console.error("[profile] fetch activities failed:", error);
        setActivitiesError("Unable to load activities. Please try again.");
      }

      const created = (createdResult.data ?? []) as ActivityRecord[];
      setCreatedActivities(
        sortActivitiesByDate(created.map(toActivityRow)),
      );

      const joinedRows = (joinedResult.data ?? []) as JoinedActivityRecord[];
      const joined = joinedRows.flatMap((row) => {
        if (!row.activity) return [];
        return Array.isArray(row.activity) ? row.activity : [row.activity];
      });

      setJoinedActivities(
        sortActivitiesByDate(joined.map(toActivityRow)),
      );
      setActivitiesLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [isOwnProfile, userId]);

  const displayedActivities =
    activityView === "created" ? createdActivities : joinedActivities;

  async function handleMessagePress() {
    if (!profile) return;

    const { data: conversationId, error } = await supabase.rpc(
      "get_or_create_direct_conversation",
      { other_user_id: profile.id },
    );

    if (error || !conversationId) {
      console.error("[profile] get_or_create_direct_conversation failed:", error);
      return;
    }

    router.push({
      pathname: "/chat/[id]",
      params: {
        id: conversationId,
        name: profile.full_name ?? "",
        avatar: resolveAvatarUri(profile.profile_picture),
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
            {selectedNames.map((interest) => (
              <InterestChips label={interest} key={interest} />
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

          {isOwnProfile && (
            <View style={styles.activityFilter}>
              <ActivitySegmentedControl
                value={activityView}
                onChange={setActivityView}
              />
            </View>
          )}

          <View style={styles.activitiesList}>
            {activitiesLoading ? (
              <ActivityIndicator
                color={colors.tint}
                style={styles.activitiesLoader}
              />
            ) : activitiesError ? (
              <Text
                style={[
                  styles.activitiesMessage,
                  { color: colors.error, fontFamily: Fonts.sans },
                ]}
              >
                {activitiesError}
              </Text>
            ) : displayedActivities.length === 0 ? (
              <Text
                style={[
                  styles.activitiesMessage,
                  { color: colors.icon, fontFamily: Fonts.sans },
                ]}
              >
                {isOwnProfile
                  ? activityView === "created"
                    ? "You haven't created an activity yet."
                    : "You haven't joined an activity yet."
                  : "No activities yet."}
              </Text>
            ) : (
              displayedActivities.map((activity) => (
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

        {isOwnProfile && <LogoutButton />}
      </ScrollView>

      {isOwnProfile && (
        <InterestPickerSheet
          visible={pickerVisible}
          onClose={() => setPickerVisible(false)}
          currentInterests={selectedNames}
          options={allInterestNames}
          onSave={(next) => {
            saveInterests(next);
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
  activityFilter: {
    paddingTop: 15,
  },
  activitiesLoader: {
    paddingVertical: 24,
  },
  activitiesMessage: {
    fontSize: 14,
    paddingTop: 15,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
});
