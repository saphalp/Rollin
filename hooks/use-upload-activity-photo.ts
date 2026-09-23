import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { Alert } from "react-native";

import { supabase } from "@/lib/supabase";

async function uploadImage(
  asset: ImagePicker.ImagePickerAsset,
  activityId: string,
  userId: string,
): Promise<string> {
  const contentType = asset.mimeType ?? "image/jpeg";
  const ext =
    contentType === "image/png"
      ? "png"
      : contentType === "image/webp"
        ? "webp"
        : "jpg";
  const path = `${userId}/${activityId}/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}.${ext}`;

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
    throw new Error(msg || "Upload failed");
  }

  return path;
}

export function useUploadActivityPhoto(activityId: string) {
  const [saving, setSaving] = useState(false);

  async function upload(
    assets: ImagePicker.ImagePickerAsset[],
    caption: string,
  ): Promise<boolean> {
    if (assets.length === 0) return false;

    setSaving(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      Alert.alert("Not logged in", "Please log in to share a photo.");
      setSaving(false);
      return false;
    }

    let paths: string[];
    try {
      paths = await Promise.all(
        assets.map((asset) => uploadImage(asset, activityId, user.id)),
      );
    } catch (uploadError: any) {
      Alert.alert(
        "Photo upload failed",
        uploadError?.message ?? "Something went wrong.",
      );
      setSaving(false);
      return false;
    }

    const { data: post, error } = await supabase
      .from("activity_photos")
      .insert({
        activity_id: activityId,
        user_id: user.id,
        image_path: paths[0],
        caption: caption || null,
      })
      .select("id")
      .single();

    if (error || !post) {
      Alert.alert("Couldn't save post", error?.message ?? "Something went wrong.");
      setSaving(false);
      return false;
    }

    const { error: imagesError } = await supabase
      .from("activity_photo_images")
      .insert(
        paths.map((path, index) => ({
          post_id: post.id,
          user_id: user.id,
          image_path: path,
          position: index,
        })),
      );

    setSaving(false);

    if (imagesError) {
      Alert.alert("Couldn't save post images", imagesError.message);
      return false;
    }

    return true;
  }

  return { saving, upload };
}
