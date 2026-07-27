import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/text';
import { AppView } from '@/components/view';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function OfferRideScreen() {
    const theme = useColorScheme() ?? 'light';
    const colors = Colors[theme];
    const insets = useSafeAreaInsets();
    const { activityId } = useLocalSearchParams<{
        activityId?: string;
    }>();

    return (
        <AppView
            style={[
                styles.container,
                {
                    backgroundColor: colors.background,
                    paddingTop: insets.top + 18,
                },
            ]}
        >
            <View
                style={[
                    styles.iconContainer,
                    {
                        backgroundColor: colors.primaryContainer,
                    },
                ]}
            >
                <MaterialCommunityIcons
                    name="car-plus"
                    size={30}
                    color={colors.onPrimary}
                />
            </View>

            <AppText
                style={[
                    styles.title,
                    {
                        color: colors.text,
                        fontFamily: Fonts?.sans,
                    },
                ]}
            >
                Offer a Ride
            </AppText>

            <AppText
                style={[
                    styles.subtitle,
                    {
                        color: colors.icon,
                        fontFamily: Fonts?.sans,
                    },
                ]}
            >
                {activityId
                    ? 'This ride will be connected to the selected activity.'
                    : 'Create a general trip or connect the ride to an activity.'}
            </AppText>
        </AppView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: 20,
    },
    iconContainer: {
        width: 58,
        height: 58,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        marginTop: 18,
        fontSize: 28,
        fontWeight: '800',
    },
    subtitle: {
        marginTop: 8,
        fontSize: 14,
        lineHeight: 20,
    },
});