import type { ImagePickerAsset } from "expo-image-picker";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, View } from "react-native";
import { Button } from "react-native-paper";

import AvatarCard from "@/components/profile/AvatarCard";
import { getProfilePictureUrl } from "@/lib/profile/get-profile-picture";
import { selectProfileImage } from "@/lib/profile/select-profile-image";
import { uploadProfilePicture } from "@/lib/profile/upload-profile-picture";

type ProfileAvatarProps = {
  verified?: boolean;
  editable?: boolean;
};

export default function ProfileAvatar({
  verified = false,
  editable = false,
}: ProfileAvatarProps) {
  const [selectedImage, setSelectedImage] =
    useState<ImagePickerAsset | null>(null);

  const [profilePictureUrl, setProfilePictureUrl] =
    useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    loadProfilePicture();
  }, []);

  async function loadProfilePicture() {
    try {
      setIsLoading(true);

      const url = await getProfilePictureUrl();

      setProfilePictureUrl(url);
    } catch (error) {
      console.error("Unable to load profile picture:", error);
    } finally {
      setIsLoading(false);
    }
  }

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

      const uploadedPicture = await uploadProfilePicture(
        selectedImage
      );

      setProfilePictureUrl(uploadedPicture.publicUrl);
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

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const displayedImage =
    selectedImage?.uri ??
    profilePictureUrl ??
    "https://picsum.photos/seed/default-profile/400/400";

  return (
    <View>
      <AvatarCard
        avatarImg={{ uri: displayedImage }}
        verified={verified}
        editable={editable}
        onEditPress={handleSelectImage}
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
  loadingContainer: {
    minHeight: 144,
    alignItems: "center",
    justifyContent: "center",
  },

  actions: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
  },
});