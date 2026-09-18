import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Alert, Platform } from 'react-native';

// Importing the notifications barrel initializes push-token registration in SDK 57.
// Avoid evaluating it in Android Expo Go; show arrival feedback in-app instead.
const useInAppArrival = Platform.OS === 'web' ||
    (Platform.OS === 'android' &&
        Constants.executionEnvironment === ExecutionEnvironment.StoreClient);

let configured = false;

export async function configureRideNotifications(): Promise<void> {
    if (configured || useInAppArrival) {
        return;
    }

    const Notifications = await import('expo-notifications');
    Notifications.setNotificationHandler({
        handleNotification: async () =>
            ({
                shouldShowBanner: true,
                shouldShowList: true,
                shouldPlaySound: true,
                shouldSetBadge: false,
            }),
    });

    if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('ride-arrivals', {
            name: 'Ride arrivals',
            importance: Notifications.AndroidImportance.HIGH,
            sound: 'default',
        });
    }

    const permissions = await Notifications.getPermissionsAsync();
    if (!permissions.granted) {
        await Notifications.requestPermissionsAsync();
    }

    configured = true;
}

export async function notifyDriverArrived(): Promise<void> {
    if (useInAppArrival) {
        if (Platform.OS !== 'web') {
            Alert.alert('Your driver has arrived',
                'Your ride is within about 0.06 miles of your pickup location.');
        }
        return;
    }
    await configureRideNotifications();
    const Notifications = await import('expo-notifications');
    const permissions = await Notifications.getPermissionsAsync();
    if (!permissions.granted) return;

    await Notifications.scheduleNotificationAsync({
        content: {
            title: 'Your driver has arrived',
            body: 'Your ride is within about 0.06 miles of your pickup location.',
            sound: 'default',
            data: {
                type: 'ride-arrival',
            },
        },
        trigger: null,
    });
}
