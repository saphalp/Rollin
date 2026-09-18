import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import {
  Alert,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Button, IconButton, Text } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PostField } from "@/components/post/post-field";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors, Fonts } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useUploadActivityPhoto } from "@/hooks/use-upload-activity-photo";

type Props = {
  visible: boolean;
  activityId: string;
  onClose: () => void;
  onUploaded?: () => void;
};

export function UploadPhotoSheet({
  visible,
  activityId,
  onClose,
  onUploaded,
}: Props) {
  const theme = useColorScheme() ?? "light";
  const colors = Colors[theme];
  const insets = useSafeAreaInsets();
  const { saving, upload } = useUploadActivityPhoto(activityId);

  const [imageAsset, setImageAsset] =
    useState<ImagePicker.ImagePickerAsset | null>(null);
  const [caption, setCaption] = useState("");

  async function pickImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        "Permission required",
        "Photo library access is needed to select an image.",
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) setImageAsset(result.assets[0]);
  }

  function reset() {
    setImageAsset(null);
    setCaption("");
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleSubmit() {
    if (!imageAsset) {
      Alert.alert("Add a photo", "Pick a photo to share first.");
      return;
    }
    const ok = await upload(imageAsset, caption.trim());
    if (ok) {
      reset();
      onUploaded?.();
      onClose();
    }
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View style={styles.container}>
        <Pressable style={styles.backdrop} onPress={handleClose} />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface,
              paddingBottom: insets.bottom + 16,
            },
          ]}
        >
          <View
            style={[styles.handle, { backgroundColor: colors.outlineVariant }]}
          />

          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text
                style={[
                  styles.title,
                  { color: colors.text, fontFamily: Fonts?.sans },
                ]}
              >
                Share a photo
              </Text>
              <Text
                style={[
                  styles.subtitle,
                  { color: colors.icon, fontFamily: Fonts?.sans },
                ]}
              >
                Post a memory from this activity to Explore.
              </Text>
            </View>
            <IconButton
              icon="close"
              size={20}
              onPress={handleClose}
              iconColor={colors.icon}
              style={styles.closeButton}
            />
          </View>

          <View
            style={[
              styles.imageSection,
              {
                borderColor: colors.outlineVariant,
                backgroundColor: colors.cardBackground,
              },
            ]}
          >
            {imageAsset ? (
              <TouchableOpacity onPress={pickImage} activeOpacity={0.85}>
                <Image
                  source={{ uri: imageAsset.uri }}
                  style={styles.imagePreview}
                  resizeMode="cover"
                />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={pickImage}
                style={[
                  styles.imagePlaceholder,
                  { borderColor: colors.outline },
                ]}
              >
                <IconSymbol name="camera.fill" size={28} color={colors.outline} />
                <Text
                  style={[
                    styles.imagePlaceholderText,
                    { color: colors.outline, fontFamily: Fonts?.sans },
                  ]}
                >
                  Tap to add a photo
                </Text>
              </TouchableOpacity>
            )}
          </View>

          <PostField
            label="Caption (optional)"
            value={caption}
            onChangeText={setCaption}
            multiline
            placeholder="Say something about this moment..."
          />

          <Button
            mode="contained"
            onPress={handleSubmit}
            disabled={saving || !imageAsset}
            loading={saving}
            buttonColor={colors.tint}
            textColor={colors.onPrimary}
            style={styles.submitButton}
            contentStyle={styles.submitButtonContent}
            labelStyle={styles.submitButtonLabel}
          >
            {saving ? "Posting..." : "Post to Explore"}
          </Button>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 8,
    gap: 16,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 4,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  headerText: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  closeButton: {
    margin: 0,
    marginTop: -6,
    marginRight: -6,
  },
  imageSection: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
  },
  imagePlaceholder: {
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderRadius: 12,
    height: 200,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  imagePlaceholderText: {
    fontSize: 14,
  },
  imagePreview: {
    width: "100%",
    height: 220,
    borderRadius: 12,
  },
  submitButton: {
    borderRadius: 14,
  },
  submitButtonContent: {
    height: 52,
  },
  submitButtonLabel: {
    fontSize: 16,
    fontWeight: "700",
  },
});
