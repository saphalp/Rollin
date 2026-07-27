import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/text';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export type ActivityMapItem = {
    id: string;
    title: string;
    location: string;
    dateTime: string | null;
    category: string | null;
    coordinate: {
        latitude: number;
        longitude: number;
    };
};

type RideDiscoveryMapProps = {
    activities: ActivityMapItem[];
    currentCoordinate: {
        latitude: number;
        longitude: number;
    } | null;
    selectedActivityId: string | null;
    onSelectActivity: (activityId: string) => void;
};

export function RideDiscoveryMap({
    activities,
}: RideDiscoveryMapProps) {
    const theme = useColorScheme() ?? 'light';
    const colors = Colors[theme];

    return (
        <View
            style={[
                styles.container,
                {
                    backgroundColor: colors.surfaceContainerHigh,
                },
            ]}
        >
            <View
                style={[
                    styles.iconContainer,
                    {
                        backgroundColor: colors.surfaceContainer,
                    },
                ]}
            >
                <MaterialCommunityIcons
                    name="map-outline"
                    size={30}
                    color={colors.tint}
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
                Map preview is available in the mobile app
            </AppText>

            <AppText
                style={[
                    styles.message,
                    {
                        color: colors.icon,
                        fontFamily: Fonts?.sans,
                    },
                ]}
            >
                {activities.length} upcoming activities have map
                coordinates.
            </AppText>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconContainer: {
        width: 58,
        height: 58,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        marginTop: 14,
        fontSize: 15,
        fontWeight: '800',
        textAlign: 'center',
    },
    message: {
        marginTop: 6,
        fontSize: 12,
        lineHeight: 18,
        textAlign: 'center',
    },
});
