import * as ImagePicker from "expo-image-picker";
import { Alert } from "react-native";

type SelectProfileImageOptions = {
  /** Used in the action sheet title and permission messages, e.g. "profile picture". */
  label?: string;
  /** Crop aspect ratio (honored on Android; iOS always crops square). */
  aspect?: [number, number];
};

export async function selectProfileImage({
  label = "profile picture",
  aspect = [1, 1],
}: SelectProfileImageOptions = {}): Promise<
  ImagePicker.ImagePickerAsset | null
> {
  return new Promise((resolve) => {
    const openCamera = async () => {
      try {
        const permission =
          await ImagePicker.requestCameraPermissionsAsync();

        if (!permission.granted) {
          Alert.alert(
            "Permission required",
            `Camera access is needed to take a ${label}.`
          );

          resolve(null);
          return;
        }

        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: ["images"],
          allowsEditing: true,
          aspect,
          quality: 0.8,
          base64: true,
        });

        if (result.canceled || result.assets.length === 0) {
          resolve(null);
          return;
        }

        resolve(result.assets[0]);
      } catch (error) {
        console.error("Camera picker error:", error);

        Alert.alert(
          "Unable to open camera",
          "Something went wrong while opening the camera."
        );

        resolve(null);
      }
    };

    const openGallery = async () => {
      try {
        const permission =
          await ImagePicker.requestMediaLibraryPermissionsAsync();

        if (!permission.granted) {
          Alert.alert(
            "Permission required",
            `Photo library access is needed to select a ${label}.`
          );

          resolve(null);
          return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          allowsEditing: true,
          aspect,
          quality: 0.8,
          base64: true,
        });

        if (result.canceled || result.assets.length === 0) {
          resolve(null);
          return;
        }

        resolve(result.assets[0]);
      } catch (error) {
        console.error("Gallery picker error:", error);

        Alert.alert(
          "Unable to open gallery",
          "Something went wrong while opening your photo library."
        );

        resolve(null);
      }
    };

    Alert.alert(`Select ${label}`, "", [
      {
        text: "Take Photo",
        onPress: openCamera,
      },
      {
        text: "Choose from Gallery",
        onPress: openGallery,
      },
      {
        text: "Cancel",
        style: "cancel",
        onPress: () => resolve(null),
      },
    ]);
  });
}