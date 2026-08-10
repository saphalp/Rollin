import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText } from "@/components/text";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { AppView } from "@/components/view";
import { Colors, Fonts } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { resolveAvatarUri } from "@/lib/profile/resolve-avatar-uri";
import { supabase } from "@/lib/supabase";

const CATEGORY_IMAGES: Record<string, string> = {
  social: "https://picsum.photos/seed/social/900/500",
  sports: "https://picsum.photos/seed/sports/900/500",
  music: "https://picsum.photos/seed/music/900/500",
  study: "https://picsum.photos/seed/study/900/500",
  outdoor: "https://picsum.photos/seed/outdoor/900/500",
  gaming: "https://picsum.photos/seed/gaming/900/500",
  grocery: "https://picsum.photos/seed/grocery/900/500",
};

type ActivityDetail = {
  id: string;
  title: string;
  category: string;
  description: string | null;
  image_url: string | null;
  date_time: string | null;
  location: string | null;
  max_attendees: number;
  ride_sharing: boolean;
  event_type: "public" | "private";
  host_id: string;
  rsvps: { id: string }[];
};

type JoinRequestStatus = "none" | "pending" | "accepted" | "rejected";

type Profile = {
  full_name: string | null;
  profile_picture: string | null;
};

type Attendee = {
  id: string;
  full_name: string;
  avatarUrl: string | null;
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function ActivityDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useColorScheme() ?? "light";
  const colors = Colors[theme];
  const insets = useSafeAreaInsets();

  const [activity, setActivity] = useState<ActivityDetail | null>(null);
  const [host, setHost] = useState<Profile | null>(null);
  const [hostAvatarUrl, setHostAvatarUrl] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [hasRsvp, setHasRsvp] = useState(false);
  const [rsvpCount, setRsvpCount] = useState(0);
  const [myRequestStatus, setMyRequestStatus] =
    useState<JoinRequestStatus>("none");
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [attendeesOpen, setAttendeesOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [rsvpLoading, setRsvpLoading] = useState(false);

  useEffect(() => {
    if (id) load();
  }, [id]);

  async function load() {
    const [
      {
        data: { user },
      },
      { data: act, error },
    ] = await Promise.all([
      supabase.auth.getUser(),
      supabase
        .from("activities")
        .select(
          "id, title, category, description, image_url, date_time, location, max_attendees, ride_sharing, event_type, host_id, rsvps(id, user_id)",
        )
        .eq("id", id)
        .single(),
    ]);

    if (error || !act) {
      setLoading(false);
      return;
    }

    setActivity(act as ActivityDetail);
    setCurrentUserId(user?.id ?? null);
    setRsvpCount((act as any).rsvps?.length ?? 0);
    setHasRsvp(
      user
        ? (act as any).rsvps?.some((r: any) => r.user_id === user.id)
        : false,
    );

    if (user && act.event_type === "private" && user.id !== act.host_id) {
      const { data: joinRequest } = await supabase
        .from("activity_join_requests")
        .select("status")
        .eq("activity_id", act.id)
        .eq("requester_id", user.id)
        .maybeSingle();

      setMyRequestStatus((joinRequest?.status as JoinRequestStatus) ?? "none");
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, profile_picture")
      .eq("id", act.host_id)
      .single();

    if (profile) {
      setHost(profile);
      if (profile.profile_picture) {
        setHostAvatarUrl(
          supabase.storage.from("avatars").getPublicUrl(profile.profile_picture)
            .data.publicUrl,
        );
      }
    }

    const rsvpUserIds =
      (act as any).rsvps?.map((r: any) => r.user_id).filter(Boolean) ?? [];
    if (rsvpUserIds.length > 0) {
      const { data: attendeeProfiles } = await supabase
        .from("profiles")
        .select("id, full_name, email, profile_picture")
        .in("id", rsvpUserIds);

      if (attendeeProfiles) {
        setAttendees(
          attendeeProfiles.map((p: any) => ({
            id: p.id,
            full_name: p.full_name ?? p.email?.split("@")[0] ?? "Rollin' User",
            avatarUrl: resolveAvatarUri(p.profile_picture)
              ? supabase.storage.from("avatars").getPublicUrl(p.profile_picture)
                  .data.publicUrl
              : null,
          })),
        );
      }
    }

    setLoading(false);
  }

  async function deleteActivity() {
    if (!activity) return;
    Alert.alert(
      "Delete Activity",
      "Are you sure you want to delete this activity? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const rsvpResult = await supabase
              .from("rsvps")
              .delete()
              .eq("activity_id", activity.id);
            console.log("rsvp delete:", JSON.stringify(rsvpResult));
            const actResult = await supabase
              .from("activities")
              .delete()
              .eq("id", activity.id);
            console.log("activity delete:", JSON.stringify(actResult));
            if (actResult.error) {
              Alert.alert("Error", actResult.error.message);
            } else {
              router.back();
            }
          },
        },
      ],
    );
  }

  async function toggleRsvp() {
    if (!activity || !currentUserId) return;
    setRsvpLoading(true);

    if (hasRsvp) {
      const { error } = await supabase
        .from("rsvps")
        .delete()
        .eq("activity_id", activity.id)
        .eq("user_id", currentUserId);
      if (error) {
        console.error("[rsvp] delete failed:", error);
        Alert.alert("Could not leave activity", error.message);
      } else {
        setHasRsvp(false);
        setRsvpCount((c) => c - 1);

        if (activity.event_type === "private") {
          await supabase
            .from("activity_join_requests")
            .delete()
            .eq("activity_id", activity.id)
            .eq("requester_id", currentUserId);
          setMyRequestStatus("none");
        }
      }
    } else {
      const { error } = await supabase
        .from("rsvps")
        .insert({ activity_id: activity.id, user_id: currentUserId });
      if (error) {
        console.error("[rsvp] insert failed:", error);
        Alert.alert("Could not join activity", error.message);
      } else {
        setHasRsvp(true);
        setRsvpCount((c) => c + 1);
      }
    }

    setRsvpLoading(false);
  }

  async function handleRequestToJoin() {
    if (!activity || !currentUserId) return;
    setRsvpLoading(true);

    const { error } = await supabase.from("activity_join_requests").upsert(
      {
        activity_id: activity.id,
        requester_id: currentUserId,
        status: "pending",
      },
      { onConflict: "activity_id,requester_id" },
    );

    if (error) {
      console.error("[join-request] upsert failed:", error);
      Alert.alert("Could not send request", error.message);
    } else {
      setMyRequestStatus("pending");
    }

    setRsvpLoading(false);
  }

  if (loading) {
    return (
      <AppView style={[styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator color={colors.tint} />
      </AppView>
    );
  }

  if (!activity) {
    return (
      <AppView style={[styles.centered, { paddingTop: insets.top }]}>
        <AppText style={{ color: colors.outline }}>Activity not found.</AppText>
      </AppView>
    );
  }

  const heroImage =
    activity.image_url ??
    CATEGORY_IMAGES[activity.category] ??
    "https://picsum.photos/seed/activity/900/500";
  const hostName = host?.full_name ?? "Rollin' User";
  const initials = hostName
    .trim()
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <AppView style={{ flex: 1 }}>
      <ScrollView
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroContainer}>
          <Image
            source={{ uri: heroImage }}
            style={styles.hero}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
          <View style={[styles.heroOverlay, { paddingTop: insets.top + 8 }]}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={[
                styles.backButton,
                { backgroundColor: colors.background },
              ]}
            >
              <IconSymbol name="chevron.left" size={20} color={colors.text} />
            </TouchableOpacity>
            <View
              style={[styles.categoryBadge, { backgroundColor: colors.tint }]}
            >
              <AppText
                style={[
                  styles.categoryText,
                  { color: colors.onImageOverlay, fontFamily: Fonts?.sans },
                ]}
              >
                {activity.category.charAt(0).toUpperCase() +
                  activity.category.slice(1)}
              </AppText>
            </View>
          </View>
        </View>

        <View style={styles.body}>
          {/* Title */}
          <AppText
            style={[
              styles.title,
              { color: colors.text, fontFamily: Fonts?.sans },
            ]}
          >
            {activity.title}
          </AppText>

          {/* Host */}
          <TouchableOpacity
            style={styles.hostRow}
            activeOpacity={0.7}
            onPress={() => router.push(`/profile/${activity.host_id}`)}
          >
            {hostAvatarUrl ? (
              <Image
                source={{ uri: resolveAvatarUri(hostAvatarUrl) }}
                style={styles.hostAvatar}
              />
            ) : (
              <View
                style={[
                  styles.hostAvatar,
                  styles.hostInitials,
                  { backgroundColor: colors.tint },
                ]}
              >
                <AppText
                  style={[
                    styles.initialsText,
                    { color: colors.onImageOverlay, fontFamily: Fonts?.sans },
                  ]}
                >
                  {initials}
                </AppText>
              </View>
            )}
            <View style={styles.hostText}>
              <AppText
                style={[
                  styles.hostedByLabel,
                  { color: colors.outline, fontFamily: Fonts?.sans },
                ]}
              >
                Hosted by
              </AppText>
              <AppText
                style={[
                  styles.hostName,
                  { color: colors.text, fontFamily: Fonts?.sans },
                ]}
              >
                {hostName}
              </AppText>
            </View>
            <IconSymbol name="chevron.right" size={18} color={colors.outline} />
          </TouchableOpacity>

          <View
            style={[
              styles.metaCard,
              {
                backgroundColor: colors.surfaceContainerHigh,
                borderColor: colors.outlineVariant,
              },
            ]}
          >
            {activity.date_time && (
              <>
                <View style={styles.metaRow}>
                  <IconSymbol name="calendar" size={18} color={colors.tint} />
                  <AppText
                    style={[
                      styles.metaText,
                      { color: colors.text, fontFamily: Fonts?.sans },
                    ]}
                  >
                    {formatDate(activity.date_time)}
                  </AppText>
                </View>
                <View style={styles.metaDivider} />
                <View style={styles.metaRow}>
                  <IconSymbol name="clock" size={18} color={colors.tint} />
                  <AppText
                    style={[
                      styles.metaText,
                      { color: colors.text, fontFamily: Fonts?.sans },
                    ]}
                  >
                    {formatTime(activity.date_time)}
                  </AppText>
                </View>
                <View style={styles.metaDivider} />
              </>
            )}
            {activity.location && (
              <>
                <View style={styles.metaRow}>
                  <IconSymbol name="mappin" size={18} color={colors.tint} />
                  <AppText
                    style={[
                      styles.metaText,
                      { color: colors.text, fontFamily: Fonts?.sans },
                    ]}
                  >
                    {activity.location}
                  </AppText>
                </View>
                <View style={styles.metaDivider} />
              </>
            )}
            <View style={styles.metaRow}>
              <IconSymbol name="person.2.fill" size={18} color={colors.tint} />
              <AppText
                style={[
                  styles.metaText,
                  { color: colors.text, fontFamily: Fonts?.sans },
                ]}
              >
                {rsvpCount} / {activity.max_attendees} joined
              </AppText>
            </View>
            {activity.ride_sharing && (
              <>
                <View style={styles.metaDivider} />
                <View style={styles.metaRow}>
                  <IconSymbol name="car.fill" size={18} color={colors.tint} />
                  <AppText
                    style={[
                      styles.metaText,
                      { color: colors.text, fontFamily: Fonts?.sans },
                    ]}
                  >
                    Ride sharing available
                  </AppText>
                </View>
              </>
            )}
          </View>

          {/* Description */}
          {activity.description ? (
            <View style={styles.descSection}>
              <AppText
                style={[
                  styles.sectionHeading,
                  { color: colors.text, fontFamily: Fonts?.sans },
                ]}
              >
                About
              </AppText>
              <AppText
                style={[
                  styles.description,
                  { color: colors.outline, fontFamily: Fonts?.sans },
                ]}
              >
                {activity.description}
              </AppText>
            </View>
          ) : null}

          {/* Who's joining */}
          {attendees.length > 0 && (
            <View
              style={[
                styles.attendeesCard,
                {
                  backgroundColor: colors.surfaceContainerHigh,
                  borderColor: colors.outlineVariant,
                },
              ]}
            >
              <TouchableOpacity
                style={styles.attendeesHeader}
                activeOpacity={0.7}
                onPress={() => setAttendeesOpen((o) => !o)}
              >
                <IconSymbol
                  name="person.2.fill"
                  size={18}
                  color={colors.tint}
                />
                <AppText
                  style={[
                    styles.attendeesHeaderText,
                    { color: colors.text, fontFamily: Fonts?.sans },
                  ]}
                >
                  {attendees.length}{" "}
                  {attendees.length === 1 ? "person" : "people"} joining
                </AppText>
                <IconSymbol
                  name={attendeesOpen ? "chevron.up" : "chevron.down"}
                  size={16}
                  color={colors.outline}
                />
              </TouchableOpacity>

              {attendeesOpen && (
                <View style={styles.attendeesList}>
                  {attendees.map((attendee, index) => {
                    const aInitials = attendee.full_name
                      .trim()
                      .split(" ")
                      .map((w) => w[0])
                      .slice(0, 2)
                      .join("")
                      .toUpperCase();
                    return (
                      <View key={attendee.id}>
                        {index > 0 && <View style={styles.metaDivider} />}
                        <TouchableOpacity
                          style={styles.attendeeRow}
                          activeOpacity={0.7}
                          onPress={() => router.push(`/profile/${attendee.id}`)}
                        >
                          {attendee.avatarUrl ? (
                            <Image
                              source={{ uri: attendee.avatarUrl }}
                              style={styles.attendeeAvatar}
                              contentFit="cover"
                            />
                          ) : (
                            <View
                              style={[
                                styles.attendeeAvatar,
                                styles.attendeeInitials,
                                { backgroundColor: colors.tint },
                              ]}
                            >
                              <AppText
                                style={[
                                  styles.attendeeInitialsText,
                                  {
                                    color: colors.onImageOverlay,
                                    fontFamily: Fonts?.sans,
                                  },
                                ]}
                              >
                                {aInitials}
                              </AppText>
                            </View>
                          )}
                          <AppText
                            style={[
                              styles.attendeeName,
                              { color: colors.text, fontFamily: Fonts?.sans },
                            ]}
                          >
                            {attendee.full_name}
                          </AppText>
                          <IconSymbol
                            name="chevron.right"
                            size={16}
                            color={colors.outline}
                          />
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Sticky bottom buttons */}
      <View
        style={[
          styles.bottomBar,
          {
            backgroundColor: colors.background,
            borderTopColor: colors.outlineVariant,
            paddingBottom: insets.bottom + 8,
          },
        ]}
      >
        {currentUserId === activity.host_id ? (
          <>
            <TouchableOpacity
              onPress={() => router.push(`/activity/edit/${activity.id}`)}
              style={[
                styles.rsvpButton,
                {
                  backgroundColor: colors.tint,
                  borderColor: colors.tint,
                  flex: 1,
                },
              ]}
            >
              <IconSymbol name="pencil" size={18} color={colors.onPrimary} />
              <AppText
                style={[
                  styles.rsvpText,
                  { color: colors.onPrimary, fontFamily: Fonts?.sans },
                ]}
              >
                Edit
              </AppText>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={deleteActivity}
              style={[
                styles.rideButton,
                {
                  borderColor: colors.error,
                  backgroundColor: colors.errorContainer,
                },
              ]}
            >
              <IconSymbol name="trash" size={16} color={colors.error} />
              <AppText
                style={[
                  styles.rideText,
                  { color: colors.error, fontFamily: Fonts?.sans },
                ]}
              >
                Delete
              </AppText>
            </TouchableOpacity>
          </>
        ) : (
          <>
            {!hasRsvp && activity.event_type === "private" ? (
              <TouchableOpacity
                onPress={handleRequestToJoin}
                disabled={rsvpLoading || myRequestStatus === "pending"}
                style={[
                  styles.rsvpButton,
                  myRequestStatus === "pending"
                    ? {
                        backgroundColor: colors.surfaceContainerHigh,
                        borderColor: colors.outline,
                      }
                    : {
                        backgroundColor: colors.tint,
                        borderColor: colors.tint,
                      },
                ]}
              >
                <AppText
                  style={[
                    styles.rsvpText,
                    {
                      color:
                        myRequestStatus === "pending"
                          ? colors.text
                          : colors.onImageOverlay,
                      fontFamily: Fonts?.sans,
                    },
                  ]}
                >
                  {rsvpLoading
                    ? "..."
                    : myRequestStatus === "pending"
                      ? "Request Pending"
                      : "Request to Join"}
                </AppText>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={toggleRsvp}
                disabled={rsvpLoading}
                style={[
                  styles.rsvpButton,
                  {
                    backgroundColor: hasRsvp
                      ? colors.surfaceContainerHigh
                      : colors.tint,
                    borderColor: hasRsvp ? colors.outline : colors.tint,
                  },
                ]}
              >
                {hasRsvp && (
                  <IconSymbol name="checkmark" size={18} color={colors.text} />
                )}
                <AppText
                  style={[
                    styles.rsvpText,
                    {
                      color: hasRsvp ? colors.text : colors.onImageOverlay,
                      fontFamily: Fonts?.sans,
                    },
                  ]}
                >
                  {rsvpLoading ? "..." : hasRsvp ? "Going" : "Join Activity"}
                </AppText>
              </TouchableOpacity>
            )}

            {activity.ride_sharing && !hasRsvp && (
              <TouchableOpacity
                style={[styles.rideButton, { borderColor: colors.outline }]}
              >
                <IconSymbol name="car.fill" size={16} color={colors.text} />
                <AppText
                  style={[
                    styles.rideText,
                    { color: colors.text, fontFamily: Fonts?.sans },
                  ]}
                >
                  Request Ride
                </AppText>
              </TouchableOpacity>
            )}
          </>
        )}
      </View>
    </AppView>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  heroContainer: { position: "relative" },
  hero: { width: "100%", height: 260 },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    opacity: 0.9,
  },
  categoryBadge: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  categoryText: { fontSize: 13, fontWeight: "600" },
  body: { padding: 20, gap: 20 },
  title: { fontSize: 26, fontWeight: "700", lineHeight: 32 },
  hostRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  hostText: { flex: 1 },
  hostAvatar: { width: 48, height: 48, borderRadius: 24 },
  hostInitials: { alignItems: "center", justifyContent: "center" },
  initialsText: { fontSize: 16, fontWeight: "700" },
  hostedByLabel: { fontSize: 12 },
  hostName: { fontSize: 16, fontWeight: "600", marginTop: 2 },
  metaCard: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
  },
  metaText: { fontSize: 15, flex: 1 },
  metaDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(0,0,0,0.08)",
  },
  descSection: { gap: 8 },
  sectionHeading: { fontSize: 18, fontWeight: "700" },
  description: { fontSize: 15, lineHeight: 24 },
  attendeesCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  attendeesHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  attendeesHeaderText: { flex: 1, fontSize: 15, fontWeight: "600" },
  attendeesList: { paddingHorizontal: 16 },
  attendeeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
  },
  attendeeAvatar: { width: 38, height: 38, borderRadius: 19 },
  attendeeInitials: { alignItems: "center", justifyContent: "center" },
  attendeeInitialsText: { fontSize: 14, fontWeight: "700" },
  attendeeName: { flex: 1, fontSize: 15 },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  rsvpButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 24,
    borderWidth: 1,
    paddingVertical: 14,
  },
  rsvpText: { fontSize: 16, fontWeight: "700" },
  rideButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 24,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  rideText: { fontSize: 15, fontWeight: "600" },
});
