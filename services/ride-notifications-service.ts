import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

let configured = false;

export async function configureRideNotifications(): Promise<void> {
    if (configured) {
        return;
    }

    Notifications.setNotificationHandler({
        handleNotification: async () =>
            ({
                shouldShowAlert: true,
                shouldShowBanner: true,
                shouldShowList: true,
                shouldPlaySound: true,
                shouldSetBadge: false,
            }) as any,
    });

    const permissions = await Notifications.getPermissionsAsync();

    if (!permissions.granted) {
        await Notifications.requestPermissionsAsync();
    }

    if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('ride-arrivals', {
            name: 'Ride arrivals',
            importance: Notifications.AndroidImportance.HIGH,
            sound: 'default',
        });
    }

    configured = true;
}

export async function notifyDriverArrived(): Promise<void> {
    await configureRideNotifications();

    await Notifications.scheduleNotificationAsync({
        content: {
            title: 'Your driver has arrived',
            body: 'Your ride is within about 100 meters of your pickup location.',
            sound: 'default',
            data: {
                type: 'ride-arrival',
            },
        },
        trigger: null,
    });
}
