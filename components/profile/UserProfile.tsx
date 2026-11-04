import { TourScrollView, TourTarget } from '@/components/tutorial/tour-target';
import { Colors, Fonts } from "@/constants/theme";
import { useFollow } from "@/hooks/use-follow";
import { useAuthContext } from "@/hooks/use-auth-context";
import { useProfile } from "@/hooks/use-profile";
import { useProfileInterests } from "@/hooks/use-profile-interests";
import { notifyAccountChanges } from '@/lib/account-center';
import { resolveAvatarUri } from "@/lib/profile/resolve-avatar-uri";
import { supabase } from "@/lib/supabase";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  StyleSheet,
  useColorScheme,
  View,
} from "react-native";
import { Button, Chip, Text } from "react-native-paper";
import { ProfilePrivacyGate } from './ProfilePrivacyGate';
import { ProfileSocialLinks } from './ProfileSocialLinks';

import ActivitySegmentedControl, {
  type ActivityView,
} from "@/components/profile/ActivitySegmentedControl";
import AvatarCard from "@/components/profile/AvatarCard";
import InterestChips from "@/components/profile/InterestChips";
import InterestPickerSheet from "@/components/profile/InterestPickerSheet";
import MyActivities from "@/components/profile/MyActivities";
import ProfileActionBar from "@/components/profile/ProfileActionBar";
import ProfileAvatar from "@/components/profile/ProfileAvatar";
import ProfileCover from "@/components/profile/ProfileCover";
import ProfileInfo from "@/components/profile/ProfileInfo";
import ProfileStats from "@/components/profile/ProfileStats";
import SectionHeader from "@/components/profile/SectionHeader";

import { useReviewSummary } from '@/hooks/use-review-summary';


type ActivityRow = {
  id: string;
  title: string;
  date: string;
  time: string;
  imageUri: string;
  dateTime: string | null;
  cancelled: boolean;
};

type ActivityRecord = {
  id: string;
  title: string;
  date_time: string | null;
  image_url: string | null;
  category: string | null;
  status?: string | null;
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
    cancelled: activity.status === "cancelled",
  };
}

function sortActivitiesByDate(activities: ActivityRow[]): ActivityRow[] {
  return [...activities].sort((a, b) => {
    if (!a.dateTime) return 1;
    if (!b.dateTime) return -1;
    return new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime();
  });
}

const ACTIVITIES_PAGE_SIZE = 3;

interface UserProfileProps {
  userId: string;
}

export default function UserProfile({ userId }: UserProfileProps) {
  const { claims } = useAuthContext();
  const currentUserId = claims?.sub as string | undefined;
  const isOwnProfile = !!currentUserId && !!userId && currentUserId === userId;

  if (isOwnProfile) {
    return <UserProfileContent userId={userId} />;
  }

  return (
    <ProfilePrivacyGate userId={userId}>
      <UserProfileContent userId={userId} />
    </ProfilePrivacyGate>
  );
}

function UserProfileContent({ userId }: UserProfileProps) {
  const theme = useColorScheme() ?? "light";
  const colors = Colors[theme];

  const {
    profile,
    isLoading: profileLoading,
    isOwnProfile,
    refresh: refreshProfile,
  } = useProfile(userId);
  const { followState, toggle: toggleFollow, refresh: refreshFollow } =
    useFollow(userId);
  const {
    allInterestNames,
    selectedNames,
    save: saveInterests,
    refresh: refreshInterests,
  } = useProfileInterests(userId);

  const [pickerVisible, setPickerVisible] = useState(false);
  const [activityView, setActivityView] =
    useState<ActivityView>("created");
  const [createdActivities, setCreatedActivities] = useState<ActivityRow[]>([]);
  const [joinedActivities, setJoinedActivities] = useState<ActivityRow[]>([]);
  const [hostedCount, setHostedCount] = useState(0);
  const [attendedCount, setAttendedCount] = useState(0);
  const [hasMoreCreated, setHasMoreCreated] = useState(false);
  const [hasMoreJoined, setHasMoreJoined] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const { average: rating, refresh: refreshReviews } = useReviewSummary(userId);
  const [refreshing, setRefreshing] = useState(false);
  const [rideCount, setRideCount] = useState(0);
  const [activitiesLoading, setActivitiesLoading] = useState(true);
  const [activitiesError, setActivitiesError] = useState<string | null>(null);

  const loadRideCount = useCallback(async () => {
    if (!userId) return;

    const [offeredResult, takenResult] = await Promise.all([
      supabase
        .from("rides_offered")
        .select("id", { count: "exact", head: true })
        .eq("driver_id", userId)
        .eq("status", "completed"),
      supabase
        .from("ride_requests")
        .select("id", { count: "exact", head: true })
        .eq("requester_id", userId)
        .eq("status", "completed"),
    ]);

    if (offeredResult.error) {
      console.error("[profile] offered ride count failed:", offeredResult.error);
    }
    if (takenResult.error) {
      console.error("[profile] taken ride count failed:", takenResult.error);
    }

    const offered = offeredResult.count ?? 0;
    const taken = takenResult.count ?? 0;

    setRideCount(offered + taken);
  }, [userId]);

  const loadInitialActivities = useCallback(async () => {
    if (!userId) return;
    setActivitiesLoading(true);
    setActivitiesError(null);
    setLoadMoreError(null);

    const createdRequest = supabase
      .from("activities")
      .select("id, title, date_time, image_url, category, status", { count: "exact" })
      .eq("host_id", userId)
      .is("recurrence_parent_id", null)
      .order("date_time", { ascending: false })
      .range(0, ACTIVITIES_PAGE_SIZE - 1);

    const joinedRequest = isOwnProfile
      ? supabase
        .from("rsvps")
        .select(
          "activity:activities(id, title, date_time, image_url, category, status, recurrence_parent_id)",
          { count: "exact" }
        )
        .eq("user_id", userId)
        .range(0, ACTIVITIES_PAGE_SIZE - 1)
      : supabase
        .from("rsvps")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId);

    const [createdResult, joinedResult] = await Promise.all([
      createdRequest,
      joinedRequest,
    ]);

    if (createdResult.error || joinedResult.error) {
      const error = createdResult.error ?? joinedResult.error;
      console.error("[profile] fetch activities failed:", error);
      setActivitiesError("Unable to load activities. Please try again.");
    }

    const created = (createdResult.data ?? []) as ActivityRecord[];
    const sortedCreated = sortActivitiesByDate(created.map(toActivityRow));
    setCreatedActivities(sortedCreated);

    const totalHosted = createdResult.count ?? created.length;
    setHostedCount(totalHosted);
    setHasMoreCreated(totalHosted > sortedCreated.length);

    if (isOwnProfile) {
      const joinedRows = (joinedResult.data ?? []) as JoinedActivityRecord[];
      const joined = joinedRows.flatMap((row) => {
        if (!row.activity) return [];
        const activities = Array.isArray(row.activity) ? row.activity : [row.activity];
        return activities.filter((a: any) => !a.recurrence_parent_id);
      });

      const sortedJoined = sortActivitiesByDate(joined.map(toActivityRow));
      setJoinedActivities(sortedJoined);

      const totalJoined = joinedResult.count ?? joined.length;
      setAttendedCount(totalJoined);
      setHasMoreJoined(totalJoined > sortedJoined.length);
    } else {
      setJoinedActivities([]);
      setHasMoreJoined(false);
      setAttendedCount(joinedResult.count ?? 0);
    }
    setActivitiesLoading(false);
  }, [isOwnProfile, userId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadInitialActivities();
  }, [loadInitialActivities]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadRideCount();
  }, [loadRideCount]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    notifyAccountChanges();
    try {
      await Promise.all([
        refreshProfile(),
        refreshInterests(),
        refreshFollow(),
        refreshReviews(),
        loadRideCount(),
        loadInitialActivities(),
      ]);
    } catch (err) {
      console.error("[profile] pull-to-refresh failed:", err);
    } finally {
      setRefreshing(false);
    }
  }, [
    refreshProfile,
    refreshInterests,
    refreshFollow,
    refreshReviews,
    loadRideCount,
    loadInitialActivities,
  ]);

  async function handleLoadMore() {
    if (loadingMore || !userId) return;
    setLoadingMore(true);
    setLoadMoreError(null);

    try {
      if (activityView === "created") {
        const from = createdActivities.length;
        const to = from + ACTIVITIES_PAGE_SIZE - 1;

        const { data, count, error } = await supabase
          .from("activities")
          .select("id, title, date_time, image_url, category, status", { count: "exact" })
          .eq("host_id", userId)
          .is("recurrence_parent_id", null)
          .order("date_time", { ascending: false })
          .range(from, to);

        if (error) throw error;

        const total = typeof count === "number" ? count : hostedCount;
        if (typeof count === "number") {
          setHostedCount(count);
        }

        const newRecords = (data ?? []) as ActivityRecord[];
        const newRows = newRecords.map(toActivityRow);

        setCreatedActivities((prev) => {
          const existingIds = new Set(prev.map((a) => a.id));
          const unique = newRows.filter((a) => !existingIds.has(a.id));
          return sortActivitiesByDate([...prev, ...unique]);
        });

        if (newRecords.length < ACTIVITIES_PAGE_SIZE || from + newRecords.length >= total) {
          setHasMoreCreated(false);
        }
      } else {
        const from = joinedActivities.length;
        const to = from + ACTIVITIES_PAGE_SIZE - 1;

        const { data, count, error } = await supabase
          .from("rsvps")
          .select(
            "activity:activities(id, title, date_time, image_url, category, status, recurrence_parent_id)",
            { count: "exact" }
          )
          .eq("user_id", userId)
          .range(from, to);

        if (error) throw error;

        const total = typeof count === "number" ? count : attendedCount;
        if (typeof count === "number") {
          setAttendedCount(count);
        }

        const joinedRows = (data ?? []) as JoinedActivityRecord[];
        const joined = joinedRows.flatMap((row) => {
          if (!row.activity) return [];
          const activities = Array.isArray(row.activity) ? row.activity : [row.activity];
          return activities.filter((a: any) => !a.recurrence_parent_id);
        });
        const newRows = joined.map(toActivityRow);

        setJoinedActivities((prev) => {
          const existingIds = new Set(prev.map((a) => a.id));
          const unique = newRows.filter((a) => !existingIds.has(a.id));
          return sortActivitiesByDate([...prev, ...unique]);
        });

        if (joinedRows.length < ACTIVITIES_PAGE_SIZE || from + joinedRows.length >= total) {
          setHasMoreJoined(false);
        }
      }
    } catch (err) {
      console.error("[profile] load more activities failed:", err);
      setLoadMoreError("Unable to load more activities. Tap to retry.");
    } finally {
      setLoadingMore(false);
    }
  }

  const displayedActivities =
    activityView === "created" ? createdActivities : joinedActivities;
  const hasMore =
    activityView === "created" ? hasMoreCreated : hasMoreJoined;

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
        otherUserId: profile.id,
      },
    });
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
  const isEduVerified = !!profile.is_educational_email;
  const isVerifiedDriver = !!profile.is_verified_driver;
  const university = profile.university || "";
  const major = profile.major || "";

  return (
    <>
      <TourScrollView
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.tint}
            colors={[colors.tint]}
          />
        }
      >
        <View style={styles.header}>
          <ProfileCover
            coverPicture={profile.cover_picture}
            editable={isOwnProfile}
          />
          <View style={styles.avatarOverlap}>
            {isOwnProfile ? (
              <ProfileAvatar editable />
            ) : (
              <AvatarCard
                avatarImg={{ uri: avatarUri }}
                viewable={!!profile.profile_picture}
              />
            )}
          </View>
        </View>

        <ProfileInfo
          name={name}
          university={university}
          major={major}
          isEduVerified={isEduVerified}
          isVerifiedDriver={isVerifiedDriver}
        />

        <ProfileSocialLinks userId={userId} />

        <ProfileActionBar
          isOwnProfile={isOwnProfile}
          followState={followState}
          onFollowPress={() => { void (async () => { await toggleFollow(); notifyAccountChanges(); })().catch(() => setActivitiesError("Unable to update follow status.")); }}
          onMessagePress={handleMessagePress}
        />

        <ProfileStats
          statsData={{
            attended: attendedCount,
            hosted: hostedCount,
            rides: rideCount,
            reviews: rating,
          }}
          onReviewsPress={() => router.push(`/reviews/${userId}`)}
        />

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
          <TourTarget id="profile-activities">
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
          </TourTarget>

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
                    ? "You haven't hosted an activity yet."
                    : "You haven't attended an activity yet."
                  : "No activities yet."}
              </Text>
            ) : (
              <>
                {displayedActivities.map((activity) => (
                  <MyActivities
                    key={activity.id}
                    title={activity.title}
                    date={activity.date}
                    time={activity.time}
                    image={{ uri: activity.imageUri }}
                    cancelled={activity.cancelled}
                    onPress={() => router.push(`/activity/${activity.id}`)}
                  />
                ))}

                {hasMore && (
                  <Button
                    mode="outlined"
                    onPress={() => void handleLoadMore()}
                    loading={loadingMore}
                    disabled={loadingMore}
                    textColor={colors.tint}
                    style={[styles.loadMoreButton, { borderColor: colors.tint }]}
                    labelStyle={{ fontFamily: Fonts.sans, fontWeight: "600" }}
                  >
                    Load more
                  </Button>
                )}

                {loadMoreError && (
                  <Pressable onPress={() => void handleLoadMore()} style={styles.loadMoreRetry}>
                    <Text
                      style={[
                        styles.loadMoreError,
                        { color: colors.error, fontFamily: Fonts.sans },
                      ]}
                    >
                      {loadMoreError}
                    </Text>
                  </Pressable>
                )}
              </>
            )}
          </View>
        </View>

      </TourScrollView>

      {isOwnProfile && (
        <InterestPickerSheet
          visible={pickerVisible}
          onClose={() => setPickerVisible(false)}
          currentInterests={selectedNames}
          options={allInterestNames}
          onSave={async (next) => {
            setPickerVisible(false);
            const success = await saveInterests(next);
            if (!success) {
              Alert.alert(
                "Unable to save interests",
                "Your interests could not be updated. Please try again."
              );
            }
          }}
        />
      )}

    </>
  );
}

const styles = StyleSheet.create({
  // Pulls the avatar up so the cover overlaps the top 2/3 of it
  // (AvatarCard ring is 136px tall plus 8px top padding: 8 + 136 * 2/3 ≈ 99).
  avatarOverlap: {
    marginTop: -99,
  },
  // Tightens the space before the name: the content's 25px gap plus the
  // avatar's 8px bottom padding read as too loose under the cover.
  header: {
    marginBottom: -15,
  },
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
  loadMoreButton: {
    marginTop: 8,
    borderRadius: 8,
  },
  loadMoreError: {
    fontSize: 13,
    textAlign: "center",
    marginTop: 6,
  },
  loadMoreRetry: {
    alignItems: "center",
    paddingVertical: 4,
  },
  accountActions: {
    gap: 12,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
});
