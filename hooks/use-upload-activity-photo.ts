import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { Alert } from "react-native";

import { supabase } from "@/lib/supabase";

export function useUploadActivityPhoto(activityId: string) {
  const [saving, setSaving] = useState(false);

  async function upload(
    asset: ImagePicker.ImagePickerAsset,
    caption: string,
  ): Promise<boolean> {
    setSaving(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      Alert.alert("Not logged in", "Please log in to share a photo.");
      setSaving(false);
      return false;
    }

    const contentType = asset.mimeType ?? "image/jpeg";
    const ext =
      contentType === "image/png"
        ? "png"
        : contentType === "image/webp"
          ? "webp"
          : "jpg";
    const path = `${user.id}/${activityId}/${Date.now()}.${ext}`;

    const fileResponse = await fetch(asset.uri);
    const rawBlob = await fileResponse.blob();
    const fileBlob = rawBlob.slice(0, rawBlob.size, contentType);

    const body = new FormData();
    body.append("file", fileBlob, `image.${ext}`);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    const res = await fetch(
      `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/activity-photos/${path}`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${session?.access_token}`,
          "x-upsert": "true",
        },
        body,
      },
    );

    if (!res.ok) {
      const msg = await res.text();
      Alert.alert("Photo upload failed", msg);
      setSaving(false);
      return false;
    }

    const { error } = await supabase.from("activity_photos").insert({
      activity_id: activityId,
      user_id: user.id,
      image_path: path,
      caption: caption || null,
    });

    setSaving(false);

    if (error) {
      Alert.alert("Couldn't save post", error.message);
      return false;
    }

    return true;
  }

  return { saving, upload };
}
