import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import {
    ActivityIndicator,
    RefreshControl,
    ScrollView,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AvailableRideCard } from '@/components/rides/available-ride-card';
import { RideFilterBar } from '@/components/rides/ride-filter-bar';
import { AppText } from '@/components/text';
import { AppView } from '@/components/view';
import { Colors, Fonts } from '@/constants/theme';
import { useAvailableRides } from '@/hooks/use-available-rides';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { openRideDetails } from '@/navigation/ride-navigation';
import { RideFilter } from '@/types/rides';

export default function AvailableRidesScreen() {
    const params = useLocalSearchParams<{
        activityId?: string;
        rideType?: string;
    }>();

    const theme = useColorScheme() ?? 'light';
    const colors = Colors[theme];
    const insets = useSafeAreaInsets();

    const activityId =
        typeof params.activityId === 'string' && params.activityId
            ? params.activityId
            : null;

    const initialFilter: RideFilter =
        params.rideType === 'activity'
            ? 'activity'
            : params.rideType === 'regular'
                ? 'regular'
                : 'all';

    const [filter, setFilter] = useState<RideFilter>(initialFilter);
    const [search, setSearch] = useState('');

    const { rides, loading, refreshing, errorMessage, refresh } =
        useAvailableRides({
            activityId,
            filter,
            search,
        });

    const title = activityId
        ? 'Activity Rides'
        : filter === 'regular'
            ? 'Regular Rides'
            : filter === 'activity'
                ? 'Activity Rides'
                : 'Available Rides';

    const emptyMessage = useMemo(() => {
        if (search.trim()) {
            return 'No rides match your search.';
        }

        if (activityId || filter === 'activity') {
            return 'No available rides have been posted for an activity yet.';
        }

        if (filter === 'regular') {
            return 'No regular rides are available right now.';
        }

        return 'No available rides are open right now.';
    }, [activityId, filter, search]);

    function goBack() {
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/(tabs)/rides');
        }
    }

    return (
        <AppView
            style={[
                styles.container,
                { backgroundColor: colors.background },
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

                <View style={styles.headerText}>
                    <AppText
                        style={[
                            styles.headerTitle,
                            {
                                color: colors.text,
                                fontFamily: Fonts?.sans,
                            },
                        ]}
                    >
                        {title}
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
                        Select a ride to view its details
                    </AppText>
                </View>

                <View style={styles.headerSpacer} />
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={refresh}
                        tintColor={colors.tint}
                    />
                }
                contentContainerStyle={[
                    styles.content,
                    { paddingBottom: insets.bottom + 30 },
                ]}
            >
                <View
                    style={[
                        styles.searchBox,
                        {
                            backgroundColor: colors.cardBackground,
                            borderColor: colors.outlineVariant,
                        },
                    ]}
                >
                    <MaterialCommunityIcons
                        name="magnify"
                        size={22}
                        color={colors.icon}
                    />
                    <TextInput
                        value={search}
                        onChangeText={setSearch}
                        placeholder="Search pickup, destination, or driver"
                        placeholderTextColor={colors.icon}
                        style={[
                            styles.searchInput,
                            {
                                color: colors.text,
                                fontFamily: Fonts?.sans,
                            },
                        ]}
                    />
                    {search ? (
                        <TouchableOpacity onPress={() => setSearch('')}>
                            <MaterialCommunityIcons
                                name="close-circle"
                                size={20}
                                color={colors.icon}
                            />
                        </TouchableOpacity>
                    ) : null}
                </View>

                <RideFilterBar
                    value={filter}
                    onChange={setFilter}
                    activityLocked={Boolean(activityId)}
                />

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
                            Loading available rides
                        </AppText>
                    </View>
                ) : errorMessage ? (
                    <View
                        style={[
                            styles.stateCard,
                            {
                                backgroundColor: colors.cardBackground,
                                borderColor: colors.outlineVariant,
                            },
                        ]}
                    >
                        <MaterialCommunityIcons
                            name="alert-circle-outline"
                            size={36}
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
                            Could not load rides
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
                            onPress={refresh}
                            style={[
                                styles.retryButton,
                                { backgroundColor: colors.tint },
                            ]}
                        >
                            <AppText
                                style={[
                                    styles.retryText,
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
                ) : rides.length === 0 ? (
                    <View
                        style={[
                            styles.stateCard,
                            {
                                backgroundColor: colors.cardBackground,
                                borderColor: colors.outlineVariant,
                            },
                        ]}
                    >
                        <MaterialCommunityIcons
                            name="car-off"
                            size={38}
                            color={colors.tint}
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
                            No rides found
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
                            {emptyMessage}
                        </AppText>
                    </View>
                ) : (
                    <View style={styles.list}>
                        {rides.map((ride) => (
                            <AvailableRideCard
                                key={ride.id}
                                ride={ride}
                                onPress={() =>
                                    openRideDetails(ride.id)
                                }
                            />
                        ))}
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
        minHeight: 78,
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
    headerText: {
        flex: 1,
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: '700',
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
    searchBox: {
        minHeight: 52,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderRadius: 16,
        paddingHorizontal: 14,
        gap: 9,
    },
    searchInput: {
        flex: 1,
        fontSize: 14,
    },
    list: {
        gap: 12,
    },
    centerState: {
        minHeight: 320,
        alignItems: 'center',
        justifyContent: 'center',
    },
    stateCard: {
        minHeight: 320,
        borderWidth: 1,
        borderRadius: 22,
        paddingHorizontal: 28,
        alignItems: 'center',
        justifyContent: 'center',
    },
    stateTitle: {
        marginTop: 14,
        fontSize: 18,
        fontWeight: '700',
        textAlign: 'center',
    },
    stateMessage: {
        marginTop: 7,
        fontSize: 13,
        lineHeight: 19,
        textAlign: 'center',
    },
    retryButton: {
        marginTop: 18,
        minHeight: 46,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 20,
    },
    retryText: {
        fontSize: 14,
        fontWeight: '700',
    },
});
