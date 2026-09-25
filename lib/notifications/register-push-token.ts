import Constants, { ExecutionEnvironment } from "expo-constants";
import * as Device from "expo-device";
import { Platform } from "react-native";

import { supabase } from "@/lib/supabase";

export async function registerPushToken() {
    // Remote push registration requires a development build, not Expo Go.
    if (Platform.OS === 'web' || Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
        return null;
    }
    try {
        /*
         * Push notifications need a real supported device.
         */
        if (!Device.isDevice) {
            console.log(
                "[push] Push notifications require a physical device."
            );

            return null;
        }

        const Notifications = await import('expo-notifications');

        /*
         * Android notification channel.
         */
        if (Platform.OS === "android") {
            await Notifications.setNotificationChannelAsync(
                "default",
                {
                    name: "Default",
                    importance:
                        Notifications.AndroidImportance.MAX,
                    vibrationPattern: [0, 250, 250, 250],
                }
            );
        }

        /*
         * Check notification permission.
         */
        const currentPermission =
            await Notifications.getPermissionsAsync();

        let finalStatus =
            currentPermission.status;

        /*
         * Ask if we do not already have permission.
         */
        if (finalStatus !== "granted") {
            const requestedPermission =
                await Notifications.requestPermissionsAsync();

            finalStatus =
                requestedPermission.status;
        }

        if (finalStatus !== "granted") {
            console.log(
                "[push] User did not grant notification permission."
            );

            return null;
        }

        /*
         * Get EAS project ID.
         */
        const projectId =
            Constants.expoConfig?.extra?.eas?.projectId ??
            Constants.easConfig?.projectId;

        if (!projectId) {
            throw new Error(
                "EAS project ID could not be found."
            );
        }

        /*
         * Get Expo Push Token.
         */
        const tokenResult =
            await Notifications.getExpoPushTokenAsync({
                projectId,
            });

        const expoPushToken =
            tokenResult.data;

        console.log(
            "[push] Expo token:",
            expoPushToken
        );

        /*
         * Find currently logged-in user.
         */
        const {
            data: { user },
            error: userError,
        } =
            await supabase.auth.getUser();

        if (userError || !user) {
            throw new Error(
                "No authenticated user found."
            );
        }

        /*
         * Save the device token.
         */
        const { error: saveError } =
            await supabase
                .from("push_tokens")
                .upsert(
                    {
                        profile_id:
                            user.id,

                        expo_push_token:
                            expoPushToken,

                        platform:
                            Platform.OS,

                        updated_at:
                            new Date().toISOString(),
                    },
                    {
                        onConflict:
                            "profile_id,expo_push_token",
                    }
                );

        if (saveError) {
            throw saveError;
        }

        console.log(
            "[push] Push token saved successfully."
        );

        return expoPushToken;
    } catch (error) {
        console.log(
            "[push] Registration failed:",
            error
        );

        return null;
    }
}
