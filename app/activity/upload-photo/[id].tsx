import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Button } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PostField } from "@/components/post/post-field";
import { AppText } from "@/components/text";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { AppView } from "@/components/view";
import { Colors, Fonts } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useUploadActivityPhoto } from "@/hooks/use-upload-activity-photo";

const MAX_PHOTOS = 10;

export default function UploadActivityPhotoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useColorScheme() ?? "light";
  const colors = Colors[theme];
  const insets = useSafeAreaInsets();
  const { saving, upload } = useUploadActivityPhoto(id);

  const [imageAssets, setImageAssets] =
    useState<ImagePicker.ImagePickerAsset[]>([]);
  const [caption, setCaption] = useState("");

  function goBack() {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace(`/activity/${id}`);
  }

  async function pickImages() {
    const remaining = MAX_PHOTOS - imageAssets.length;
    if (remaining <= 0) return;

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        "Permission required",
        "Photo library access is needed to select photos.",
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      orderedSelection: true,
      selectionLimit: remaining,
      quality: 0.8,
    });
    if (!result.canceled && result.assets.length > 0) {
      setImageAssets((prev) => [...prev, ...result.assets]);
    }
  }

  function removeImage(index: number) {
    setImageAssets((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit() {
    if (imageAssets.length === 0) {
      Alert.alert("Add a photo", "Pick at least one photo to share first.");
      return;
    }
    const ok = await upload(imageAssets, caption.trim());
    if (ok) goBack();
  }

  return (
    <AppView style={styles.container}>
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 8,
            borderBottomColor: colors.outlineVariant,
            backgroundColor: colors.background,
          },
        ]}
      >
        <TouchableOpacity
          onPress={goBack}
          style={[
            styles.backButton,
            { backgroundColor: colors.surfaceContainerHigh },
          ]}
        >
          <IconSymbol name="chevron.left" size={20} color={colors.text} />
        </TouchableOpacity>

        <AppText
          style={[
            styles.headerTitle,
            { color: colors.text, fontFamily: Fonts?.sans },
          ]}
        >
          Share a Photo
        </AppText>

        <View style={styles.backButton} />
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          style={{ backgroundColor: colors.background }}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.bottom + 32 },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <AppText
            style={[
              styles.subtitle,
              { color: colors.icon, fontFamily: Fonts?.sans },
            ]}
          >
            Post a memory from this activity to Explore. Add up to{" "}
            {MAX_PHOTOS} photos.
          </AppText>

          <View
            style={[
              styles.imageSection,
              {
                borderColor: colors.outlineVariant,
                backgroundColor: colors.cardBackground,
              },
            ]}
          >
            {imageAssets.length === 0 ? (
              <TouchableOpacity
                onPress={pickImages}
                style={[
                  styles.imagePlaceholder,
                  { borderColor: colors.outline },
                ]}
              >
                <IconSymbol
                  name="camera.fill"
                  size={28}
                  color={colors.outline}
                />
                <AppText
                  style={[
                    styles.imagePlaceholderText,
                    { color: colors.outline, fontFamily: Fonts?.sans },
                  ]}
                >
                  Tap to add photos
                </AppText>
              </TouchableOpacity>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.thumbnailRow}
              >
                {imageAssets.map((asset, index) => (
                  <View key={asset.assetId ?? asset.uri} style={styles.thumbnailWrap}>
                    <Image
                      source={{ uri: asset.uri }}
                      style={styles.thumbnail}
                      resizeMode="cover"
                    />

                    <TouchableOpacity
                      onPress={() => removeImage(index)}
                      style={styles.removeBadge}
                      hitSlop={6}
                    >
                      <IconSymbol
                        name="xmark.circle.fill"
                        size={20}
                        color="#FFFFFF"
                      />
                    </TouchableOpacity>
                  </View>
                ))}

                {imageAssets.length < MAX_PHOTOS && (
                  <TouchableOpacity
                    onPress={pickImages}
                    style={[
                      styles.addMoreTile,
                      { borderColor: colors.outline },
                    ]}
                  >
                    <IconSymbol name="plus" size={22} color={colors.outline} />
                  </TouchableOpacity>
                )}
              </ScrollView>
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
            disabled={saving || imageAssets.length === 0}
            loading={saving}
            buttonColor={colors.tint}
            textColor={colors.onPrimary}
            style={styles.submitButton}
            contentStyle={styles.submitButtonContent}
            labelStyle={styles.submitButtonLabel}
          >
            {saving ? "Posting..." : "Post to Explore"}
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>
    </AppView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    padding: 20,
    gap: 16,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: -8,
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
  thumbnailRow: {
    gap: 10,
  },
  thumbnailWrap: {
    position: "relative",
  },
  thumbnail: {
    width: 96,
    height: 96,
    borderRadius: 12,
  },
  removeBadge: {
    position: "absolute",
    top: -6,
    right: -6,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 10,
  },
  addMoreTile: {
    width: 96,
    height: 96,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
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
