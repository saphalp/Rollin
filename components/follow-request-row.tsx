import { router } from "expo-router";
import { Pressable, StyleSheet, useColorScheme, View } from "react-native";
import { Avatar, Button, Text } from "react-native-paper";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors, Fonts } from "@/constants/theme";
import { resolveAvatarUri } from "@/lib/profile/resolve-avatar-uri";

export type FollowRequestActor = {
  id: string;
  full_name: string | null;
  profile_picture: string | null;
};

interface FollowRequestRowProps {
  actor: FollowRequestActor;
  timestamp: string;
  isRead: boolean;
  isAccepted?: boolean;
  onAccept: () => void;
  onReject: () => void;
}

export function FollowRequestRow({
  actor,
  timestamp,
  isRead,
  isAccepted,
  onAccept,
  onReject,
}: FollowRequestRowProps) {
  const theme = useColorScheme() ?? "light";
  const colors = Colors[theme];

  const actorName = actor.full_name ?? "Someone";
  const initial = actorName.trim()[0]?.toUpperCase() ?? "?";

  function openProfile() {
    router.push(`/profile/${actor.id}`);
  }

  return (
    <View style={[styles.row, { borderBottomColor: colors.outlineVariant }]}>
      <Pressable onPress={openProfile} hitSlop={4}>
        {actor.profile_picture ? (
          <Avatar.Image
            size={44}
            source={{ uri: resolveAvatarUri(actor.profile_picture) }}
          />
        ) : (
          <Avatar.Text
            size={44}
            label={initial}
            style={{ backgroundColor: colors.tint }}
            labelStyle={{ color: colors.onPrimary }}
          />
        )}
      </Pressable>

      <View style={styles.body}>
        <Pressable onPress={openProfile}>
          <Text
            style={[styles.message, { color: colors.text, fontFamily: Fonts.sans }]}
          >
            <Text style={[styles.actorName, { color: colors.text }]}>{actorName}</Text>
            {isAccepted
              ? " — you accepted their request"
              : " requested to follow you"}
          </Text>
        </Pressable>

        <Text
          style={[
            styles.timestamp,
            { color: colors.outline, fontFamily: Fonts.sans },
          ]}
        >
          {timestamp}
        </Text>

        {isAccepted ? (
          <View style={styles.acceptedPill}>
            <IconSymbol name="checkmark" size={14} color={colors.tint} />
            <Text
              style={[
                styles.acceptedText,
                { color: colors.tint, fontFamily: Fonts.sans },
              ]}
            >
              Accepted
            </Text>
          </View>
        ) : (
          <View style={styles.buttons}>
            <Button
              mode="contained"
              onPress={onAccept}
              buttonColor={colors.tint}
              textColor={colors.onPrimary}
              style={styles.button}
              contentStyle={styles.buttonContent}
              labelStyle={styles.buttonLabel}
            >
              Accept
            </Button>
            <Button
              mode="outlined"
              onPress={onReject}
              textColor={colors.text}
              style={[styles.button, { borderColor: colors.outlineVariant }]}
              contentStyle={styles.buttonContent}
              labelStyle={styles.buttonLabel}
            >
              Reject
            </Button>
          </View>
        )}
      </View>

      {!isRead && !isAccepted && (
        <View style={[styles.dot, { backgroundColor: colors.tint }]} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  body: {
    flex: 1,
    gap: 6,
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
  },
  actorName: {
    fontWeight: "700",
  },
  timestamp: {
    fontSize: 12,
  },
  buttons: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  button: {
    borderRadius: 10,
  },
  buttonContent: {
    height: 36,
    paddingHorizontal: 4,
  },
  buttonLabel: {
    fontSize: 13,
    fontWeight: "700",
    marginVertical: 0,
  },
  acceptedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  acceptedText: {
    fontSize: 13,
    fontWeight: "600",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 8,
    flexShrink: 0,
  },
});
