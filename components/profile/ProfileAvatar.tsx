import type { ImagePickerAsset } from "expo-image-picker";
import { useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { Button } from "react-native-paper";

import AvatarCard from "@/components/profile/AvatarCard";
import { useAuthContext } from "@/hooks/use-auth-context";
import { FALLBACK_AVATAR, resolveAvatarUri } from "@/lib/profile/resolve-avatar-uri";
import { selectProfileImage } from "@/lib/profile/select-profile-image";
import { uploadProfilePicture } from "@/lib/profile/upload-profile-picture";

type ProfileAvatarProps = {
  editable?: boolean;
};

export default function ProfileAvatar({
  editable = false,
}: ProfileAvatarProps) {
  const { profile, refreshProfile } = useAuthContext();

  const [selectedImage, setSelectedImage] =
    useState<ImagePickerAsset | null>(null);

  const [isUploading, setIsUploading] = useState(false);

  async function handleSelectImage() {
    const image = await selectProfileImage();

    if (!image) {
      return;
    }

    setSelectedImage(image);
  }

  async function handleSaveImage() {
    if (!selectedImage || isUploading) {
      return;
    }

    try {
      setIsUploading(true);

      await uploadProfilePicture(selectedImage);

      // Refresh the shared auth profile state so the header, sidebar, and
      // rest of the app immediately reflect the new profile picture.
      await refreshProfile();
      setSelectedImage(null);

      Alert.alert(
        "Profile picture updated",
        "Your profile picture has been saved."
      );
    } catch (error: unknown) {
      console.error("Profile picture upload failed:", error);

      let message = "Unable to update your profile picture.";

      if (
        typeof error === "object" &&
        error !== null &&
        "message" in error &&
        typeof error.message === "string"
      ) {
        message = error.message;
      }

      Alert.alert("Upload failed", message);
    } finally {
      setIsUploading(false);
    }
  }

  const avatarUrl = profile?.profile_picture
    ? resolveAvatarUri(profile.profile_picture)
    : null;

  const displayedImage = selectedImage?.uri ?? avatarUrl ?? FALLBACK_AVATAR;

  return (
    <View>
      <AvatarCard
        avatarImg={{ uri: displayedImage }}
        editable={editable}
        onEditPress={handleSelectImage}
        viewable={displayedImage !== FALLBACK_AVATAR}
      />

      {selectedImage && (
        <View style={styles.actions}>
          <Button
            mode="outlined"
            onPress={() => setSelectedImage(null)}
            disabled={isUploading}
          >
            Cancel
          </Button>

          <Button
            mode="contained"
            onPress={handleSaveImage}
            loading={isUploading}
            disabled={isUploading}
          >
            Save Picture
          </Button>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
  },
});
