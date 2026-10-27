import AvatarViewer from "@/components/profile/AvatarViewer";
import { Colors } from "@/constants/theme";
import { useState } from "react";
import {
  ImageSourcePropType,
  Pressable,
  StyleSheet,
  useColorScheme,
  View,
} from "react-native";
import { Avatar, IconButton } from "react-native-paper";

type AvatarCardProps = {
  avatarImg: ImageSourcePropType;
  size?: number;
  editable?: boolean;
  onEditPress?: () => void;
  /** Tapping the photo opens it enlarged. Leave off for placeholder avatars. */
  viewable?: boolean;
};

export default function AvatarCard({
  avatarImg,
  size = 128,
  editable = false,
  onEditPress,
  viewable = false,
}: AvatarCardProps) {
  const scheme = useColorScheme() ?? "light";
  const colors = Colors[scheme];

  const ringSize = size + 8;
  const [viewerVisible, setViewerVisible] = useState(false);

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.ring,
          {
            width: ringSize,
            height: ringSize,
            borderRadius: ringSize / 2,
            backgroundColor: colors.surface,
            borderColor: colors.outlineVariant,
            shadowColor: colors.text,
          },
        ]}
      >
        <Pressable
          onPress={() => setViewerVisible(true)}
          disabled={!viewable}
          accessibilityRole={viewable ? "imagebutton" : undefined}
          accessibilityLabel={viewable ? "View profile picture" : undefined}
        >
          <Avatar.Image size={size} source={avatarImg} />
        </Pressable>

        {editable && (
          <IconButton
            icon="pencil"
            size={16}
            mode="contained"
            onPress={onEditPress}
            containerColor={colors.tint}
            iconColor={colors.onPrimary}
            style={[styles.editButton, { borderColor: colors.background }]}
          />
        )}
      </View>

      {viewable && (
        <AvatarViewer
          visible={viewerVisible}
          source={avatarImg}
          onClose={() => setViewerVisible(false)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    paddingVertical: 8,
  },
  ring: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  editButton: {
    position: "absolute",
    bottom: -2,
    left: -2,
    margin: 0,
    borderWidth: 2,
  },
});
