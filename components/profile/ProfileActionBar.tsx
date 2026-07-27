import { Colors } from "@/constants/theme";
import { StyleSheet, useColorScheme, View } from "react-native";
import { Button } from "react-native-paper";

export type FollowState = "not_following" | "requested" | "following";

interface ProfileActionBarProps {
  isOwnProfile: boolean;
  followState?: FollowState;
  onEditPress?: () => void;
  onFollowPress?: () => void;
  onMessagePress?: () => void;
}

export default function ProfileActionBar({
  isOwnProfile,
  followState = "not_following",
  onEditPress,
  onFollowPress,
  onMessagePress,
}: ProfileActionBarProps) {
  const theme = useColorScheme() ?? "light";
  const colors = Colors[theme];

  if (isOwnProfile) {
    return (
      <Button
        mode="contained-tonal"
        icon="pencil"
        onPress={onEditPress}
        style={styles.button}
        contentStyle={styles.buttonContent}
        labelStyle={styles.buttonLabel}
      >
        Edit Profile
      </Button>
    );
  }

  if (followState === "following") {
    return (
      <View style={styles.row}>
        <Button
          mode="outlined"
          icon="account-check"
          onPress={onFollowPress}
          style={styles.buttonFlex}
          contentStyle={styles.buttonContent}
          labelStyle={styles.buttonLabel}
        >
          Following
        </Button>
        <Button
          mode="contained"
          icon="message-text"
          onPress={onMessagePress}
          buttonColor={colors.tint}
          textColor={colors.onPrimary}
          style={styles.buttonFlex}
          contentStyle={styles.buttonContent}
          labelStyle={styles.buttonLabel}
        >
          Message
        </Button>
      </View>
    );
  }

  if (followState === "requested") {
    return (
      <Button
        mode="outlined"
        icon="clock-outline"
        onPress={onFollowPress}
        style={styles.button}
        contentStyle={styles.buttonContent}
        labelStyle={styles.buttonLabel}
      >
        Requested
      </Button>
    );
  }

  return (
    <Button
      mode="contained"
      icon="account-plus"
      onPress={onFollowPress}
      buttonColor={colors.tint}
      textColor={colors.onPrimary}
      style={styles.button}
      contentStyle={styles.buttonContent}
      labelStyle={styles.buttonLabel}
    >
      Follow
    </Button>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 10,
  },
  button: {
    borderRadius: 12,
  },
  buttonFlex: {
    flex: 1,
    borderRadius: 12,
  },
  buttonContent: {
    height: 44,
  },
  buttonLabel: {
    fontSize: 14,
    fontWeight: "700",
  },
});
