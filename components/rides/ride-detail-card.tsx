import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

import { DepartureCountdownBadge } from '@/components/rides/departure-countdown-badge';
import { AppText } from '@/components/text';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { isRideExpired } from '@/lib/ride-status';
import { fetchRatingSummary } from '@/services/ride-ratings-service';
import { RideOffer } from '@/types/rides';

type Props = {
    ride: RideOffer;
    /** Opens the driver's profile when the driver row is tapped. */
    onDriverPress?: () => void;
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

export function RideDetailCard({ ride, onDriverPress }: Props) {
    const theme = useColorScheme() ?? 'light';
    const colors = Colors[theme];
    const [rating, setRating] = useState<{ average: number | null; count: number } | null>(null);

    useEffect(() => {
        let active = true;
        fetchRatingSummary(ride.driverId)
            .then((summary) => { if (active) setRating(summary); })
            .catch(() => { if (active) setRating(null); });
        return () => { active = false; };
    }, [ride.driverId]);

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
            <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={`View ${ride.driver.name}'s profile`}
                disabled={!onDriverPress}
                onPress={onDriverPress}
                style={styles.driverRow}
            >
                {ride.driver.avatarUrl ? (
                    <Image source={{ uri: ride.driver.avatarUrl }} style={styles.avatar} contentFit="cover" />
                ) : (
                    <View
                        style={[
                            styles.avatar,
                            styles.avatarFallback,
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
                )}

                <View style={styles.driverText}>
                    <View style={styles.nameRow}>
                        <AppText
                            numberOfLines={1}
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
                        {rating && (
                            <View style={[styles.ratingChip, { backgroundColor: colors.surfaceContainer }]}>
                                <MaterialCommunityIcons
                                    name={rating.average === null ? 'star-outline' : 'star'}
                                    size={14}
                                    color={colors.secondaryContainer}
                                />
                                <AppText style={[styles.ratingText, { color: colors.text, fontFamily: Fonts?.sans }]}>
                                    {rating.average === null ? 'New' : rating.average.toFixed(1)}
                                </AppText>
                            </View>
                        )}
                    </View>
                    <AppText
                        style={[
                            styles.driverLabel,
                            {
                                color: colors.icon,
                                fontFamily: Fonts?.sans,
                            },
                        ]}
                    >
                        {rating && rating.count > 0
                            ? `Driver · ${rating.count} ${rating.count === 1 ? 'rating' : 'ratings'}`
                            : 'Driver'}
                    </AppText>
                </View>

                {onDriverPress && (
                    <MaterialCommunityIcons name="chevron-right" size={24} color={colors.tabIconDefault} />
                )}
            </TouchableOpacity>

            {/* Only a ride that hasn't started yet has a departure to count down to. */}
            {(ride.status === 'open' || ride.status === 'full') && !isRideExpired(ride) && (
                <DepartureCountdownBadge dateTime={ride.dateTime} />
            )}
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
        borderRadius: 28,
    },
    avatarFallback: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    driverText: {
        flex: 1,
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    driverName: {
        flexShrink: 1,
        fontSize: 18,
        lineHeight: 24,
        fontWeight: '700',
    },
    ratingChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        borderRadius: 12,
        paddingHorizontal: 8,
        paddingVertical: 3,
    },
    ratingText: {
        fontSize: 13,
        lineHeight: 17,
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
