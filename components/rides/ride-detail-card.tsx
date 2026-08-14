import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/text';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { RideOffer } from '@/types/rides';

type Props = {
    ride: RideOffer;
};

function formatDate(value: string | null): string {
    if (!value) {
        return 'Not provided';
    }

    const date = new Date(value);

    return Number.isNaN(date.getTime())
        ? 'Not provided'
        : date.toLocaleString(undefined, {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
        });
}

export function RideDetailCard({ ride }: Props) {
    const theme = useColorScheme() ?? 'light';
    const colors = Colors[theme];

    const rows = [
        {
            icon: 'map-marker-radius-outline' as const,
            label: 'Pickup',
            value: ride.pickupLocation,
        },
        {
            icon: 'map-marker-check-outline' as const,
            label: 'Destination',
            value: ride.destination,
        },
        {
            icon: 'calendar-clock-outline' as const,
            label: 'Departure',
            value: formatDate(ride.dateTime),
        },
        {
            icon: 'seat-passenger' as const,
            label: 'Available seats',
            value: String(ride.availableSeats),
        },
    ];

    return (
        <View
            style={[
                styles.card,
                {
                    backgroundColor: colors.cardBackground,
                    borderColor: colors.outlineVariant,
                },
            ]}
        >
            <View style={styles.driverRow}>
                <View
                    style={[
                        styles.avatar,
                        {
                            backgroundColor: colors.secondaryContainer,
                        },
                    ]}
                >
                    <MaterialCommunityIcons
                        name="account"
                        size={30}
                        color={colors.onSecondaryContainer}
                    />
                </View>

                <View style={styles.driverText}>
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
                            styles.driverLabel,
                            {
                                color: colors.icon,
                                fontFamily: Fonts?.sans,
                            },
                        ]}
                    >
                        Driver
                    </AppText>
                </View>
            </View>

            {ride.activity ? (
                <View
                    style={[
                        styles.activityBadge,
                        {
                            backgroundColor: colors.surfaceContainer,
                        },
                    ]}
                >
                    <MaterialCommunityIcons
                        name="calendar-star"
                        size={18}
                        color={colors.tint}
                    />
                    <AppText
                        style={[
                            styles.activityText,
                            {
                                color: colors.text,
                                fontFamily: Fonts?.sans,
                            },
                        ]}
                    >
                        {ride.activity.title}
                    </AppText>
                </View>
            ) : null}

            <View style={styles.rows}>
                {rows.map((row) => (
                    <View key={row.label} style={styles.detailRow}>
                        <MaterialCommunityIcons
                            name={row.icon}
                            size={21}
                            color={colors.tint}
                        />
                        <View style={styles.detailText}>
                            <AppText
                                style={[
                                    styles.detailLabel,
                                    {
                                        color: colors.icon,
                                        fontFamily: Fonts?.sans,
                                    },
                                ]}
                            >
                                {row.label}
                            </AppText>
                            <AppText
                                style={[
                                    styles.detailValue,
                                    {
                                        color: colors.text,
                                        fontFamily: Fonts?.sans,
                                    },
                                ]}
                            >
                                {row.value}
                            </AppText>
                        </View>
                    </View>
                ))}
            </View>

            {ride.notes ? (
                <View
                    style={[
                        styles.notes,
                        {
                            backgroundColor: colors.surfaceContainer,
                        },
                    ]}
                >
                    <AppText
                        style={[
                            styles.notesTitle,
                            {
                                color: colors.text,
                                fontFamily: Fonts?.sans,
                            },
                        ]}
                    >
                        Driver notes
                    </AppText>
                    <AppText
                        style={[
                            styles.notesText,
                            {
                                color: colors.icon,
                                fontFamily: Fonts?.sans,
                            },
                        ]}
                    >
                        {ride.notes}
                    </AppText>
                </View>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        borderWidth: 1,
        borderRadius: 22,
        padding: 18,
        gap: 18,
    },
    driverRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    avatar: {
        width: 56,
        height: 56,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    driverText: {
        flex: 1,
    },
    driverName: {
        fontSize: 18,
        fontWeight: '700',
    },
    driverLabel: {
        marginTop: 2,
        fontSize: 13,
    },
    activityBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        borderRadius: 14,
        paddingHorizontal: 12,
        paddingVertical: 9,
        gap: 7,
    },
    activityText: {
        fontSize: 13,
        fontWeight: '700',
    },
    rows: {
        gap: 15,
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 11,
    },
    detailText: {
        flex: 1,
    },
    detailLabel: {
        fontSize: 12,
    },
    detailValue: {
        marginTop: 2,
        fontSize: 14,
        fontWeight: '700',
        lineHeight: 20,
    },
    notes: {
        borderRadius: 16,
        padding: 14,
    },
    notesTitle: {
        fontSize: 13,
        fontWeight: '700',
    },
    notesText: {
        marginTop: 5,
        fontSize: 13,
        lineHeight: 19,
    },
});
