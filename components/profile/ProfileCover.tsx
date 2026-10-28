import { Colors } from "@/constants/theme";
import { useAuthContext } from "@/hooks/use-auth-context";
import { resolveCoverSource } from "@/lib/profile/resolve-cover-source";
import { selectProfileImage } from "@/lib/profile/select-profile-image";
import { uploadCoverPicture } from "@/lib/profile/upload-profile-picture";
import type { ImagePickerAsset } from "expo-image-picker";
import { useState } from "react";
import { Alert, Image, StyleSheet, useColorScheme, View } from "react-native";
import { Button, IconButton } from "react-native-paper";

export const COVER_HEIGHT = 200;

type ProfileCoverProps = {
  coverPicture: string | null | undefined;
  editable?: boolean;
};

export default function ProfileCover({
  coverPicture,
  editable = false,
}: ProfileCoverProps) {
  const scheme = useColorScheme() ?? "light";
  const colors = Colors[scheme];
  const { refreshProfile } = useAuthContext();

  const [selectedImage, setSelectedImage] =
    useState<ImagePickerAsset | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  async function handleSelectImage() {
    const image = await selectProfileImage({
      label: "cover picture",
      aspect: [3, 1],
    });

    if (image) {
      setSelectedImage(image);
    }
  }

  async function handleSaveImage() {
    if (!selectedImage || isUploading) {
      return;
    }

    try {
      setIsUploading(true);
      await uploadCoverPicture(selectedImage);
      // The cover is read from the auth context's profile row, so refresh it
      // before clearing the preview to avoid flashing the old cover.
      await refreshProfile();
      setSelectedImage(null);
    } catch (error: unknown) {
      console.error("Cover picture upload failed:", error);

      let message = "Unable to update your cover picture.";

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

  const source = selectedImage
    ? { uri: selectedImage.uri }
    : resolveCoverSource(coverPicture);

  return (
    <View
      style={[styles.container, { backgroundColor: colors.surfaceContainer }]}
    >
      <Image source={source} style={styles.image} resizeMode="cover" />

      {editable && (
        <View style={styles.actions}>
          {selectedImage ? (
            <>
              <Button
                mode="contained"
                compact
                onPress={() => setSelectedImage(null)}
                disabled={isUploading}
                buttonColor={colors.surface}
                textColor={colors.text}
              >
                Cancel
              </Button>
              <Button
                mode="contained"
                compact
                onPress={handleSaveImage}
                loading={isUploading}
                disabled={isUploading}
                buttonColor={colors.tint}
                textColor={colors.onPrimary}
              >
                Save Cover
              </Button>
            </>
          ) : (
            <IconButton
              icon="camera"
              size={18}
              mode="contained"
              onPress={handleSelectImage}
              containerColor={colors.surface}
              iconColor={colors.tint}
              accessibilityLabel="Change cover picture"
              style={styles.editButton}
            />
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: COVER_HEIGHT,
    borderRadius: 16,
    overflow: "hidden",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  actions: {
    position: "absolute",
    top: 8,
    right: 8,
    flexDirection: "row",
    gap: 8,
  },
  editButton: {
    margin: 0,
  },
});
