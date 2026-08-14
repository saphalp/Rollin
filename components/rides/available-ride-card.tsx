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

    const rideDescription = ride.activity
        ? `Ride to ${ride.activity.title}`
        : 'Regular trip';

    const seatLabel =
        ride.availableSeats === 1
            ? '1 seat available'
            : `${ride.availableSeats} seats available`;

    return (
        <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`View ride offered by ${ride.driver.name}`}
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
                        styles.offererIcon,
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
                            styles.offererName,
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
                            styles.offererLabel,
                            {
                                color: colors.icon,
                                fontFamily: Fonts?.sans,
                            },
                        ]}
                    >
                        Offering this ride
                    </AppText>

                    <AppText
                        numberOfLines={1}
                        style={[
                            styles.rideType,
                            {
                                color: colors.tint,
                                fontFamily: Fonts?.sans,
                            },
                        ]}
                    >
                        {rideDescription}
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
                            styles.seatCount,
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

            <View style={styles.routeContainer}>
                <View style={styles.routeRail}>
                    <View
                        style={[
                            styles.pickupDot,
                            {
                                backgroundColor: colors.tint,
                            },
                        ]}
                    />

                    <View
                        style={[
                            styles.routeLine,
                            {
                                backgroundColor: colors.outlineVariant,
                            },
                        ]}
                    />

                    <MaterialCommunityIcons
                        name="map-marker"
                        size={19}
                        color={colors.error}
                    />
                </View>

                <View style={styles.routeTextContainer}>
                    <View>
                        <AppText
                            style={[
                                styles.routeLabel,
                                {
                                    color: colors.icon,
                                    fontFamily: Fonts?.sans,
                                },
                            ]}
                        >
                            Pickup
                        </AppText>

                        <AppText
                            numberOfLines={2}
                            style={[
                                styles.locationText,
                                {
                                    color: colors.text,
                                    fontFamily: Fonts?.sans,
                                },
                            ]}
                        >
                            {ride.pickupLocation}
                        </AppText>
                    </View>

                    <View>
                        <AppText
                            style={[
                                styles.routeLabel,
                                {
                                    color: colors.icon,
                                    fontFamily: Fonts?.sans,
                                },
                            ]}
                        >
                            Destination
                        </AppText>

                        <AppText
                            numberOfLines={2}
                            style={[
                                styles.locationText,
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
            </View>

            <View
                style={[
                    styles.footer,
                    {
                        borderTopColor: colors.outlineVariant,
                    },
                ]}
            >
                <View style={styles.footerInfo}>
                    <View style={styles.metadataRow}>
                        <MaterialCommunityIcons
                            name="clock-outline"
                            size={18}
                            color={colors.icon}
                        />

                        <AppText
                            style={[
                                styles.metadataText,
                                {
                                    color: colors.icon,
                                    fontFamily: Fonts?.sans,
                                },
                            ]}
                        >
                            {formatDate(ride.dateTime)}
                        </AppText>
                    </View>

                    <View style={styles.metadataRow}>
                        <MaterialCommunityIcons
                            name="car-seat"
                            size={18}
                            color={colors.icon}
                        />

                        <AppText
                            style={[
                                styles.metadataText,
                                {
                                    color: colors.icon,
                                    fontFamily: Fonts?.sans,
                                },
                            ]}
                        >
                            {seatLabel}
                        </AppText>
                    </View>
                </View>

                <View
                    style={[
                        styles.detailsButton,
                        {
                            backgroundColor: colors.surfaceContainer,
                        },
                    ]}
                >
                    <AppText
                        style={[
                            styles.detailsText,
                            {
                                color: colors.tint,
                                fontFamily: Fonts?.sans,
                            },
                        ]}
                    >
                        View
                    </AppText>

                    <MaterialCommunityIcons
                        name="chevron-right"
                        size={21}
                        color={colors.tint}
                    />
                </View>
            </View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    card: {
        borderWidth: 1,
        borderRadius: 20,
        padding: 16,
        gap: 16,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 11,
    },
    offererIcon: {
        width: 48,
        height: 48,
        borderRadius: 15,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerText: {
        flex: 1,
    },
    offererName: {
        fontSize: 16,
        fontWeight: '700',
    },
    offererLabel: {
        marginTop: 1,
        fontSize: 11,
    },
    rideType: {
        marginTop: 3,
        fontSize: 12,
        fontWeight: '700',
    },
    seatBadge: {
        minWidth: 48,
        height: 34,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 17,
        paddingHorizontal: 9,
        gap: 4,
    },
    seatCount: {
        fontSize: 13,
        fontWeight: '700',
    },
    routeContainer: {
        flexDirection: 'row',
        gap: 11,
    },
    routeRail: {
        width: 20,
        alignItems: 'center',
        paddingTop: 4,
    },
    pickupDot: {
        width: 11,
        height: 11,
        borderRadius: 6,
    },
    routeLine: {
        width: 2,
        flex: 1,
        minHeight: 40,
        marginVertical: 3,
    },
    routeTextContainer: {
        flex: 1,
        gap: 15,
    },
    routeLabel: {
        fontSize: 11,
    },
    locationText: {
        marginTop: 2,
        fontSize: 14,
        fontWeight: '700',
        lineHeight: 20,
    },
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderTopWidth: 1,
        paddingTop: 14,
        gap: 12,
    },
    footerInfo: {
        flex: 1,
        gap: 7,
    },
    metadataRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 7,
    },
    metadataText: {
        flex: 1,
        fontSize: 12,
        lineHeight: 17,
    },
    detailsButton: {
        minHeight: 40,
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 13,
        paddingHorizontal: 12,
        gap: 2,
    },
    detailsText: {
        fontSize: 13,
        fontWeight: '700',
    },
});