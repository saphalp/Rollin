import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

import { AppText } from '@/components/text';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { RideOffer } from '@/types/rides';

type Props = {
    ride: RideOffer;
    onPress: () => void;
};

function formatDate(value: string | null): string {
    if (!value) {
        return 'Departure time unavailable';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return 'Departure time unavailable';
    }

    return date.toLocaleString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
}

export function AvailableRideCard({ ride, onPress }: Props) {
    const theme = useColorScheme() ?? 'light';
    const colors = Colors[theme];

    return (
        <TouchableOpacity
            accessibilityRole="button"
            onPress={onPress}
            activeOpacity={0.86}
            style={[
                styles.card,
                {
                    backgroundColor: colors.cardBackground,
                    borderColor: colors.outlineVariant,
                },
            ]}
        >
            <View style={styles.header}>
                <View
                    style={[
                        styles.driverIcon,
                        {
                            backgroundColor: colors.secondaryContainer,
                        },
                    ]}
                >
                    <MaterialCommunityIcons
                        name="account"
                        size={24}
                        color={colors.onSecondaryContainer}
                    />
                </View>

                <View style={styles.headerText}>
                    <AppText
                        style={[
                            styles.driverName,
                            {
                                color: colors.text,
                                fontFamily: Fonts?.sans,
                            },
                        ]}
                    >
                        {ride.driver.name}
                    </AppText>

                    <AppText
                        style={[
                            styles.rideType,
                            {
                                color: colors.icon,
                                fontFamily: Fonts?.sans,
                            },
                        ]}
                    >
                        {ride.activity
                            ? ride.activity.title
                            : 'Regular ride'}
                    </AppText>
                </View>

                <View
                    style={[
                        styles.seatBadge,
                        {
                            backgroundColor: colors.surfaceContainer,
                        },
                    ]}
                >
                    <MaterialCommunityIcons
                        name="seat-passenger"
                        size={16}
                        color={colors.tint}
                    />
                    <AppText
                        style={[
                            styles.seatText,
                            {
                                color: colors.tint,
                                fontFamily: Fonts?.sans,
                            },
                        ]}
                    >
                        {ride.availableSeats}
                    </AppText>
                </View>
            </View>

            <View style={styles.routeRow}>
                <View style={styles.routeRail}>
                    <View
                        style={[
                            styles.routeDot,
                            { backgroundColor: colors.tint },
                        ]}
                    />
                    <View
                        style={[
                            styles.routeLine,
                            { backgroundColor: colors.outlineVariant },
                        ]}
                    />
                    <MaterialCommunityIcons
                        name="map-marker"
                        size={18}
                        color={colors.error}
                    />
                </View>

                <View style={styles.routeText}>
                    <AppText
                        numberOfLines={1}
                        style={[
                            styles.location,
                            {
                                color: colors.text,
                                fontFamily: Fonts?.sans,
                            },
                        ]}
                    >
                        {ride.pickupLocation}
                    </AppText>
                    <AppText
                        numberOfLines={1}
                        style={[
                            styles.location,
                            {
                                color: colors.text,
                                fontFamily: Fonts?.sans,
                            },
                        ]}
                    >
                        {ride.destination}
                    </AppText>
                </View>
            </View>

            <View style={styles.footer}>
                <View style={styles.dateRow}>
                    <MaterialCommunityIcons
                        name="clock-outline"
                        size={18}
                        color={colors.icon}
                    />
                    <AppText
                        style={[
                            styles.dateText,
                            {
                                color: colors.icon,
                                fontFamily: Fonts?.sans,
                            },
                        ]}
                    >
                        {formatDate(ride.dateTime)}
                    </AppText>
                </View>

                <MaterialCommunityIcons
                    name="chevron-right"
                    size={24}
                    color={colors.tint}
                />
            </View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    card: {
        borderWidth: 1,
        borderRadius: 20,
        padding: 16,
        gap: 15,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 11,
    },
    driverIcon: {
        width: 46,
        height: 46,
        borderRadius: 15,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerText: {
        flex: 1,
    },
    driverName: {
        fontSize: 16,
        fontWeight: '800',
    },
    rideType: {
        marginTop: 2,
        fontSize: 12,
    },
    seatBadge: {
        minWidth: 48,
        height: 34,
        borderRadius: 17,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 9,
        gap: 4,
    },
    seatText: {
        fontSize: 13,
        fontWeight: '800',
    },
    routeRow: {
        flexDirection: 'row',
        gap: 11,
    },
    routeRail: {
        width: 20,
        alignItems: 'center',
    },
    routeDot: {
        width: 11,
        height: 11,
        borderRadius: 6,
    },
    routeLine: {
        width: 2,
        height: 30,
    },
    routeText: {
        flex: 1,
        justifyContent: 'space-between',
        minHeight: 60,
    },
    location: {
        fontSize: 14,
        fontWeight: '700',
    },
    footer: {
        minHeight: 42,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    dateRow: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 7,
    },
    dateText: {
        flex: 1,
        fontSize: 12,
    },
});
