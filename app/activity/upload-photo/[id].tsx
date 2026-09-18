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

export default function UploadActivityPhotoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useColorScheme() ?? "light";
  const colors = Colors[theme];
  const insets = useSafeAreaInsets();
  const { saving, upload } = useUploadActivityPhoto(id);

  const [imageAsset, setImageAsset] =
    useState<ImagePicker.ImagePickerAsset | null>(null);
  const [caption, setCaption] = useState("");

  function goBack() {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace(`/activity/${id}`);
  }

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

  async function handleSubmit() {
    if (!imageAsset) {
      Alert.alert("Add a photo", "Pick a photo to share first.");
      return;
    }
    const ok = await upload(imageAsset, caption.trim());
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
            Post a memory from this activity to Explore.
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
                  Tap to add a photo
                </AppText>
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
