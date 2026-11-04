import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

import { RideActivityBadge } from '@/components/rides/ride-activity-badge';
import { AppText } from '@/components/text';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
    IncomingSeatRequestDashboardItem,
    MyRideRequestDashboardItem,
    OfferedRideDashboardItem,
    RideHistoryDashboardItem,
} from '@/services/ride-dashboard-service';
import type { RideOffer, WantedRide } from '@/types/rides';

/** "Requested by others": a seat request on your ride, or someone's posted ride request. */
export type OthersRideRequestItem =
    | { kind: 'seat'; request: IncomingSeatRequestDashboardItem }
    | { kind: 'wanted'; request: WantedRide };

function formatDate(value: string | null) {
    if (!value) return 'Departure time not provided';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Departure time not provided';

    return date.toLocaleString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
}

export function OfferedRideDashboardCard({
    ride,
    onPress,
}: {
    ride: OfferedRideDashboardItem;
    onPress: () => void;
}) {
    const theme = useColorScheme() ?? 'light';
    const colors = Colors[theme];

    return (
        <TouchableOpacity
            accessibilityRole="button"
            onPress={onPress}
            style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.outlineVariant }]}
        >
            <View style={styles.header}>
                <View style={[styles.icon, { backgroundColor: colors.primaryContainer }]}>
                    <MaterialCommunityIcons name="car-outline" size={22} color={colors.onPrimary} />
                </View>

                <View style={styles.headerText}>
                    <AppText
                        numberOfLines={1}
                        style={[styles.route, { color: colors.text, fontFamily: Fonts?.sans }]}
                    >
                        {ride.pickupLocation} → {ride.destination}
                    </AppText>
                    <AppText style={[styles.meta, { color: colors.icon, fontFamily: Fonts?.sans }]}>
                        {formatDate(ride.dateTime)}
                    </AppText>
                </View>

                <MaterialCommunityIcons name="chevron-right" size={23} color={colors.tint} />
            </View>

            <RideActivityBadge activityTitle={ride.activityTitle} />

            <View style={styles.stats}>
                <View style={[styles.stat, { backgroundColor: colors.surfaceContainer }]}>
                    <AppText style={[styles.statValue, { color: colors.tint, fontFamily: Fonts?.sans }]}>
                        {ride.availableSeats}
                    </AppText>
                    <AppText style={[styles.statLabel, { color: colors.icon, fontFamily: Fonts?.sans }]}>
                        seats left
                    </AppText>
                </View>

                <View style={[styles.stat, { backgroundColor: colors.surfaceContainer }]}>
                    <AppText style={[styles.statValue, { color: colors.tint, fontFamily: Fonts?.sans }]}>
                        {ride.requestCount}
                    </AppText>
                    <AppText style={[styles.statLabel, { color: colors.icon, fontFamily: Fonts?.sans }]}>
                        requests
                    </AppText>
                </View>

                <View style={[styles.statusBadge, { backgroundColor: colors.surfaceContainer }]}>
                    <AppText style={[styles.statusText, { color: colors.text, fontFamily: Fonts?.sans }]}>
                        {ride.status.replace('_', ' ')}
                    </AppText>
                </View>
            </View>
        </TouchableOpacity>
    );
}

export function MyRideRequestDashboardCard({
    request,
    onPress,
}: {
    request: MyRideRequestDashboardItem;
    onPress: () => void;
}) {
    const theme = useColorScheme() ?? 'light';
    const colors = Colors[theme];

    return (
        <TouchableOpacity
            accessibilityRole="button"
            onPress={onPress}
            style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.outlineVariant }]}
        >
            <View style={styles.header}>
                <View style={[styles.icon, { backgroundColor: colors.secondaryContainer }]}>
                    <MaterialCommunityIcons
                        name={request.kind === 'wanted' ? 'car-search-outline' : 'account-arrow-right-outline'}
                        size={22}
                        color={colors.onSecondaryContainer}
                    />
                </View>

                <View style={styles.headerText}>
                    <AppText
                        numberOfLines={1}
                        style={[styles.route, { color: colors.text, fontFamily: Fonts?.sans }]}
                    >
                        {request.pickupLocation} → {request.destination}
                    </AppText>
                    <AppText style={[styles.meta, { color: colors.icon, fontFamily: Fonts?.sans }]}>
                        {request.kind === 'wanted'
                            ? 'Waiting for a driver'
                            : `Ride offered by ${request.offererName}`}
                    </AppText>
                </View>

                <View style={[styles.statusBadge, { backgroundColor: colors.surfaceContainer }]}>
                    <AppText style={[styles.statusText, { color: colors.tint, fontFamily: Fonts?.sans }]}>
                        {request.status}
                    </AppText>
                </View>
            </View>

            <View style={styles.row}>
                <MaterialCommunityIcons name="clock-outline" size={17} color={colors.icon} />
                <AppText style={[styles.meta, { color: colors.icon, fontFamily: Fonts?.sans }]}>
                    {formatDate(request.dateTime)}
                </AppText>
            </View>

            <RideActivityBadge activityTitle={request.activityTitle} />
        </TouchableOpacity>
    );
}

/** An open ride someone else is offering. Tapping opens the ride to request a seat. */
export function OthersRideOfferDashboardCard({
    ride,
    onPress,
}: {
    ride: RideOffer;
    onPress: () => void;
}) {
    const theme = useColorScheme() ?? 'light';
    const colors = Colors[theme];

    return (
        <TouchableOpacity
            accessibilityRole="button"
            onPress={onPress}
            style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.outlineVariant }]}
        >
            <View style={styles.header}>
                <View>
                    {ride.driver.avatarUrl ? (
                        <Image source={{ uri: ride.driver.avatarUrl }} style={styles.avatar} contentFit="cover" />
                    ) : (
                        <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: colors.surfaceContainer }]}>
                            <MaterialCommunityIcons name="account" size={24} color={colors.icon} />
                        </View>
                    )}
                    <View style={[styles.kindIcon, { backgroundColor: colors.surfaceContainer, borderColor: colors.cardBackground }]}>
                        <MaterialCommunityIcons name="car-outline" size={12} color={colors.tint} />
                    </View>
                </View>

                <View style={styles.headerText}>
                    <AppText
                        numberOfLines={1}
                        style={[styles.route, { color: colors.text, fontFamily: Fonts?.sans }]}
                    >
                        {ride.pickupLocation || 'Individual pickups'} → {ride.destination}
                    </AppText>
                    <AppText style={[styles.meta, { color: colors.icon, fontFamily: Fonts?.sans }]}>
                        Offered by {ride.driver.name}
                    </AppText>
                </View>

                <MaterialCommunityIcons name="chevron-right" size={23} color={colors.tint} />
            </View>

            <View style={styles.row}>
                <MaterialCommunityIcons name="clock-outline" size={17} color={colors.icon} />
                <AppText style={[styles.meta, styles.flexMeta, { color: colors.icon, fontFamily: Fonts?.sans }]}>
                    {formatDate(ride.dateTime)}
                </AppText>
                <AppText style={[styles.seats, { color: colors.tint, fontFamily: Fonts?.sans }]}>
                    {ride.availableSeats} {ride.availableSeats === 1 ? 'seat' : 'seats'} left
                </AppText>
            </View>

            <RideActivityBadge activityTitle={ride.activity?.title} />
        </TouchableOpacity>
    );
}

/** A request from someone else: a seat on your ride to review, or a ride they need. */
export function OthersRideRequestDashboardCard({
    item,
    onPress,
}: {
    item: OthersRideRequestItem;
    onPress: () => void;
}) {
    const theme = useColorScheme() ?? 'light';
    const colors = Colors[theme];
    const isSeat = item.kind === 'seat';
    const name = isSeat ? item.request.requesterName : item.request.requester.name;
    const avatarUrl = isSeat ? item.request.requesterAvatarUrl : item.request.requester.avatarUrl;
    const activityTitle = isSeat ? item.request.activityTitle : item.request.activity?.title;

    return (
        <TouchableOpacity
            accessibilityRole="button"
            onPress={onPress}
            style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.outlineVariant }]}
        >
            <View style={styles.header}>
                <View>
                    {avatarUrl ? (
                        <Image source={{ uri: avatarUrl }} style={styles.avatar} contentFit="cover" />
                    ) : (
                        <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: colors.surfaceContainer }]}>
                            <MaterialCommunityIcons name="account" size={24} color={colors.icon} />
                        </View>
                    )}
                    {/* Small corner icon: seat request on your ride vs. a ride they need. */}
                    <View style={[styles.kindIcon, { backgroundColor: colors.secondaryContainer, borderColor: colors.cardBackground }]}>
                        <MaterialCommunityIcons
                            name={isSeat ? 'account-arrow-right-outline' : 'car-search-outline'}
                            size={12}
                            color={colors.onSecondaryContainer}
                        />
                    </View>
                </View>

                <View style={styles.headerText}>
                    <AppText
                        numberOfLines={1}
                        style={[styles.route, { color: colors.text, fontFamily: Fonts?.sans }]}
                    >
                        {item.request.pickupLocation} → {item.request.destination}
                    </AppText>
                    <AppText style={[styles.meta, { color: colors.icon, fontFamily: Fonts?.sans }]}>
                        {isSeat ? `${name} wants a seat on your ride` : `${name} needs a ride`}
                    </AppText>
                </View>

                <View style={[styles.statusBadge, { backgroundColor: colors.surfaceContainer }]}>
                    <AppText style={[styles.actionText, { color: colors.tint, fontFamily: Fonts?.sans }]}>
                        {isSeat ? 'Review' : 'Offer ride'}
                    </AppText>
                </View>
            </View>

            <View style={styles.row}>
                <MaterialCommunityIcons name="clock-outline" size={17} color={colors.icon} />
                <AppText style={[styles.meta, { color: colors.icon, fontFamily: Fonts?.sans }]}>
                    {formatDate(item.request.dateTime)}
                </AppText>
            </View>

            <RideActivityBadge activityTitle={activityTitle} />
        </TouchableOpacity>
    );
}

export function RideHistoryDashboardCard({
    item,
    onPress,
}: {
    item: RideHistoryDashboardItem;
    onPress?: () => void;
}) {
    const theme = useColorScheme() ?? 'light';
    const colors = Colors[theme];

    return (
        <TouchableOpacity
            accessibilityRole="button"
            disabled={!onPress}
            onPress={onPress}
            style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.outlineVariant }]}
        >
            <View style={styles.header}>
                <View style={[styles.icon, { backgroundColor: colors.surfaceContainer }]}>
                    <MaterialCommunityIcons
                        name={item.type === 'offered' ? 'car-outline' : 'history'}
                        size={22}
                        color={colors.tint}
                    />
                </View>

                <View style={styles.headerText}>
                    <AppText
                        numberOfLines={2}
                        style={[styles.route, { color: colors.text, fontFamily: Fonts?.sans }]}
                    >
                        {item.pickupLocation} → {item.destination}
                    </AppText>
                    <AppText style={[styles.meta, { color: colors.icon, fontFamily: Fonts?.sans }]}>
                        {formatDate(item.dateTime)}
                    </AppText>
                    <AppText style={[styles.meta, { color: colors.icon, fontFamily: Fonts?.sans }]}>
                        {item.counterpart}
                    </AppText>
                </View>

                <View style={[styles.statusBadge, { backgroundColor: colors.surfaceContainer }]}>
                    <AppText style={[styles.statusText, { color: colors.text, fontFamily: Fonts?.sans }]}>
                        {item.status}
                    </AppText>
                </View>
            </View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    card: {
        borderWidth: 1,
        borderRadius: 18,
        padding: 14,
        gap: 12,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    icon: {
        width: 44,
        height: 44,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerText: {
        flex: 1,
    },
    route: {
        fontSize: 15,
        fontWeight: '700',
    },
    meta: {
        marginTop: 3,
        fontSize: 12,
        lineHeight: 17,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 7,
    },
    stats: {
        flexDirection: 'row',
        gap: 8,
    },
    stat: {
        flex: 1,
        borderRadius: 13,
        padding: 10,
    },
    statValue: {
        fontSize: 16,
        fontWeight: '700',
    },
    statLabel: {
        marginTop: 1,
        fontSize: 11,
    },
    statusBadge: {
        alignSelf: 'center',
        borderRadius: 12,
        paddingHorizontal: 10,
        paddingVertical: 7,
    },
    statusText: {
        fontSize: 11,
        fontWeight: '600',
        textTransform: 'capitalize',
    },
    avatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
    },
    avatarFallback: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    kindIcon: {
        position: 'absolute',
        right: -4,
        bottom: -4,
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 2,
        alignItems: 'center',
        justifyContent: 'center',
    },
    actionText: {
        fontSize: 12,
        fontWeight: '700',
    },
    flexMeta: {
        flex: 1,
        marginTop: 0,
    },
    seats: {
        fontSize: 12,
        lineHeight: 17,
        fontWeight: '700',
    },
});
