import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    RefreshControl,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/text';
import { AppView } from '@/components/view';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { supabase } from '@/lib/supabase';

type RideEnabledActivity = {
    id: string;
    title: string;
    category: string | null;
    description: string | null;
    image_url: string | null;
    location: string;
    date_time: string | null;
    rides_available: number;
    latitude: number | null;
    longitude: number | null;
    host_id: string;
};

export default function FindRideScreen() {
    const theme = useColorScheme() ?? 'light';
    const colors = Colors[theme];
    const insets = useSafeAreaInsets();

    const [activities, setActivities] = useState<
        RideEnabledActivity[]
    >([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [errorMessage, setErrorMessage] =
        useState<string | null>(null);

    const loadRideActivities = useCallback(async () => {
        setErrorMessage(null);

        const { data, error } = await supabase
            .from('activities')
            .select(
                [
                    'id',
                    'title',
                    'category',
                    'description',
                    'image_url',
                    'location',
                    'date_time',
                    'rides_available',
                    'latitude',
                    'longitude',
                    'host_id',
                ].join(', '),
            )
            .gt('rides_available', 0)
            .gte('date_time', new Date().toISOString())
            .order('date_time', { ascending: true });

        if (error) {
            setErrorMessage(error.message);
            setActivities([]);
            return;
        }

        setActivities(
            (data ?? []).map((activity) => ({
                ...activity,
                rides_available: Number(activity.rides_available ?? 0),
                latitude:
                    activity.latitude == null
                        ? null
                        : Number(activity.latitude),
                longitude:
                    activity.longitude == null
                        ? null
                        : Number(activity.longitude),
            })),
        );
    }, []);

    useEffect(() => {
        loadRideActivities().finally(() => setLoading(false));
    }, [loadRideActivities]);

    async function handleRefresh() {
        setRefreshing(true);

        try {
            await loadRideActivities();
        } finally {
            setRefreshing(false);
        }
    }

    function goBack() {
        if (router.canGoBack()) {
            router.back();
            return;
        }

        router.replace('/(tabs)/rides');
    }

    function openActivity(activityId: string) {
        router.push({
            pathname: '/activity/[id]',
            params: {
                id: activityId,
                rideMode: 'find',
            },
        });
    }

    function formatDate(value: string | null) {
        if (!value) {
            return 'Date not provided';
        }

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return 'Date not provided';
        }

        return date.toLocaleString(undefined, {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
        });
    }

    function renderActivityCard(activity: RideEnabledActivity) {
        const seatLabel =
            activity.rides_available === 1
                ? '1 seat available'
                : `${activity.rides_available} seats available`;

        return (
            <TouchableOpacity
                key={activity.id}
                accessibilityRole="button"
                onPress={() => openActivity(activity.id)}
                activeOpacity={0.85}
                style={[
                    styles.activityCard,
                    {
                        backgroundColor: colors.cardBackground,
                        borderColor: colors.outlineVariant,
                    },
                ]}
            >
                <View style={styles.activityHeader}>
                    <View
                        style={[
                            styles.activityIcon,
                            {
                                backgroundColor: colors.secondaryContainer,
                            },
                        ]}
                    >
                        <MaterialCommunityIcons
                            name="calendar-marker-outline"
                            size={24}
                            color={colors.onSecondaryContainer}
                        />
                    </View>

                    <View style={styles.activityTitleContainer}>
                        <AppText
                            numberOfLines={2}
                            style={[
                                styles.activityTitle,
                                {
                                    color: colors.text,
                                    fontFamily: Fonts?.sans,
                                },
                            ]}
                        >
                            {activity.title}
                        </AppText>

                        {activity.category ? (
                            <AppText
                                style={[
                                    styles.categoryText,
                                    {
                                        color: colors.icon,
                                        fontFamily: Fonts?.sans,
                                    },
                                ]}
                            >
                                {activity.category}
                            </AppText>
                        ) : null}
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
                                styles.seatBadgeText,
                                {
                                    color: colors.tint,
                                    fontFamily: Fonts?.sans,
                                },
                            ]}
                        >
                            {activity.rides_available}
                        </AppText>
                    </View>
                </View>

                <View style={styles.metadataRow}>
                    <MaterialCommunityIcons
                        name="map-marker-outline"
                        size={18}
                        color={colors.icon}
                    />

                    <AppText
                        numberOfLines={2}
                        style={[
                            styles.metadataText,
                            {
                                color: colors.icon,
                                fontFamily: Fonts?.sans,
                            },
                        ]}
                    >
                        {activity.location}
                    </AppText>
                </View>

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
                        {formatDate(activity.date_time)}
                    </AppText>
                </View>

                <View
                    style={[
                        styles.availableRow,
                        {
                            backgroundColor: colors.surfaceContainer,
                        },
                    ]}
                >
                    <View style={styles.availableTextRow}>
                        <MaterialCommunityIcons
                            name="car-multiple"
                            size={20}
                            color={colors.tint}
                        />

                        <AppText
                            style={[
                                styles.availableText,
                                {
                                    color: colors.text,
                                    fontFamily: Fonts?.sans,
                                },
                            ]}
                        >
                            {seatLabel}
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

    return (
        <AppView
            style={[
                styles.container,
                {
                    backgroundColor: colors.background,
                },
            ]}
        >
            <View
                style={[
                    styles.header,
                    {
                        paddingTop: insets.top + 10,
                        backgroundColor: colors.cardBackground,
                        borderBottomColor: colors.outlineVariant,
                    },
                ]}
            >
                <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Go back to rides"
                    onPress={goBack}
                    style={[
                        styles.backButton,
                        {
                            backgroundColor: colors.surfaceContainer,
                            borderColor: colors.outlineVariant,
                        },
                    ]}
                >
                    <MaterialCommunityIcons
                        name="arrow-left"
                        size={24}
                        color={colors.text}
                    />
                </TouchableOpacity>

                <View style={styles.headerTitleContainer}>
                    <AppText
                        style={[
                            styles.headerTitle,
                            {
                                color: colors.text,
                                fontFamily: Fonts?.sans,
                            },
                        ]}
                    >
                        Find a Ride
                    </AppText>

                    <AppText
                        style={[
                            styles.headerSubtitle,
                            {
                                color: colors.icon,
                                fontFamily: Fonts?.sans,
                            },
                        ]}
                    >
                        Events with ride sharing enabled
                    </AppText>
                </View>

                <View style={styles.headerSpacer} />
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={[
                    styles.content,
                    {
                        paddingBottom: insets.bottom + 30,
                    },
                ]}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={handleRefresh}
                        tintColor={colors.tint}
                    />
                }
            >
                <View
                    style={[
                        styles.infoCard,
                        {
                            backgroundColor: colors.surfaceContainer,
                            borderColor: colors.outlineVariant,
                        },
                    ]}
                >
                    <MaterialCommunityIcons
                        name="information-outline"
                        size={22}
                        color={colors.tint}
                    />

                    <AppText
                        style={[
                            styles.infoText,
                            {
                                color: colors.icon,
                                fontFamily: Fonts?.sans,
                            },
                        ]}
                    >
                        These public events were posted with ride sharing
                        turned on. Open an event to request a seat.
                    </AppText>
                </View>

                {loading ? (
                    <View style={styles.centerState}>
                        <ActivityIndicator
                            size="large"
                            color={colors.tint}
                        />

                        <AppText
                            style={[
                                styles.stateMessage,
                                {
                                    color: colors.icon,
                                    fontFamily: Fonts?.sans,
                                },
                            ]}
                        >
                            Loading ride-enabled events
                        </AppText>
                    </View>
                ) : errorMessage ? (
                    <View
                        style={[
                            styles.centerStateCard,
                            {
                                backgroundColor: colors.cardBackground,
                                borderColor: colors.outlineVariant,
                            },
                        ]}
                    >
                        <MaterialCommunityIcons
                            name="alert-circle-outline"
                            size={34}
                            color={colors.error}
                        />

                        <AppText
                            style={[
                                styles.stateTitle,
                                {
                                    color: colors.text,
                                    fontFamily: Fonts?.sans,
                                },
                            ]}
                        >
                            Unable to load events
                        </AppText>

                        <AppText
                            style={[
                                styles.stateMessage,
                                {
                                    color: colors.icon,
                                    fontFamily: Fonts?.sans,
                                },
                            ]}
                        >
                            {errorMessage}
                        </AppText>

                        <TouchableOpacity
                            onPress={handleRefresh}
                            style={[
                                styles.retryButton,
                                {
                                    backgroundColor: colors.tint,
                                },
                            ]}
                        >
                            <MaterialCommunityIcons
                                name="refresh"
                                size={19}
                                color={colors.onPrimary}
                            />

                            <AppText
                                style={[
                                    styles.retryButtonText,
                                    {
                                        color: colors.onPrimary,
                                        fontFamily: Fonts?.sans,
                                    },
                                ]}
                            >
                                Try Again
                            </AppText>
                        </TouchableOpacity>
                    </View>
                ) : activities.length === 0 ? (
                    <View
                        style={[
                            styles.centerStateCard,
                            {
                                backgroundColor: colors.cardBackground,
                                borderColor: colors.outlineVariant,
                            },
                        ]}
                    >
                        <View
                            style={[
                                styles.emptyIcon,
                                {
                                    backgroundColor: colors.surfaceContainer,
                                },
                            ]}
                        >
                            <MaterialCommunityIcons
                                name="car-off"
                                size={32}
                                color={colors.tint}
                            />
                        </View>

                        <AppText
                            style={[
                                styles.stateTitle,
                                {
                                    color: colors.text,
                                    fontFamily: Fonts?.sans,
                                },
                            ]}
                        >
                            No ride-enabled events
                        </AppText>

                        <AppText
                            style={[
                                styles.stateMessage,
                                {
                                    color: colors.icon,
                                    fontFamily: Fonts?.sans,
                                },
                            ]}
                        >
                            Upcoming events with available ride-sharing seats
                            will appear here.
                        </AppText>
                    </View>
                ) : (
                    <View style={styles.activityList}>
                        {activities.map(renderActivityCard)}
                    </View>
                )}
            </ScrollView>
        </AppView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        minHeight: 76,
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomWidth: 1,
        paddingHorizontal: 16,
        paddingBottom: 10,
        gap: 12,
    },
    backButton: {
        width: 44,
        height: 44,
        borderWidth: 1,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitleContainer: {
        flex: 1,
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: '800',
    },
    headerSubtitle: {
        marginTop: 1,
        fontSize: 12,
    },
    headerSpacer: {
        width: 44,
    },
    content: {
        padding: 16,
        gap: 14,
    },
    infoCard: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        borderWidth: 1,
        borderRadius: 16,
        padding: 14,
        gap: 10,
    },
    infoText: {
        flex: 1,
        fontSize: 13,
        lineHeight: 19,
    },
    activityList: {
        gap: 12,
    },
    activityCard: {
        borderWidth: 1,
        borderRadius: 18,
        padding: 15,
        gap: 12,
    },
    activityHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 11,
    },
    activityIcon: {
        width: 46,
        height: 46,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    activityTitleContainer: {
        flex: 1,
    },
    activityTitle: {
        fontSize: 16,
        fontWeight: '800',
    },
    categoryText: {
        marginTop: 2,
        fontSize: 12,
        textTransform: 'capitalize',
    },
    seatBadge: {
        minWidth: 47,
        height: 34,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 17,
        paddingHorizontal: 9,
        gap: 4,
    },
    seatBadgeText: {
        fontSize: 13,
        fontWeight: '800',
    },
    metadataRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
    },
    metadataText: {
        flex: 1,
        fontSize: 13,
        lineHeight: 19,
    },
    availableRow: {
        minHeight: 48,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderRadius: 14,
        paddingHorizontal: 13,
        gap: 10,
    },
    availableTextRow: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    availableText: {
        flex: 1,
        fontSize: 13,
        fontWeight: '700',
    },
    centerState: {
        minHeight: 300,
        alignItems: 'center',
        justifyContent: 'center',
    },
    centerStateCard: {
        minHeight: 300,
        borderWidth: 1,
        borderRadius: 20,
        paddingHorizontal: 28,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyIcon: {
        width: 64,
        height: 64,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    stateTitle: {
        marginTop: 16,
        fontSize: 18,
        fontWeight: '800',
        textAlign: 'center',
    },
    stateMessage: {
        marginTop: 8,
        fontSize: 13,
        lineHeight: 19,
        textAlign: 'center',
    },
    retryButton: {
        marginTop: 18,
        minHeight: 46,
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 14,
        paddingHorizontal: 20,
        gap: 8,
    },
    retryButtonText: {
        fontSize: 14,
        fontWeight: '800',
    },
});