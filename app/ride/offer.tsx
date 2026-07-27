import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import {
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

export default function OfferRideScreen() {
    const theme = useColorScheme() ?? 'light';
    const colors = Colors[theme];
    const insets = useSafeAreaInsets();

    const { activityId } = useLocalSearchParams<{
        activityId?: string;
    }>();

    function goBack() {
        if (router.canGoBack()) {
            router.back();
            return;
        }

        router.replace('/(tabs)/rides');
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
                        borderBottomColor: colors.outlineVariant,
                        backgroundColor: colors.cardBackground,
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
                        numberOfLines={1}
                        style={[
                            styles.headerTitle,
                            {
                                color: colors.text,
                                fontFamily: Fonts?.sans,
                            },
                        ]}
                    >
                        Offer a Ride
                    </AppText>

                    <AppText
                        numberOfLines={1}
                        style={[
                            styles.headerSubtitle,
                            {
                                color: colors.icon,
                                fontFamily: Fonts?.sans,
                            },
                        ]}
                    >
                        Share your available seats
                    </AppText>
                </View>

                <View style={styles.headerSpacer} />
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={[
                    styles.content,
                    {
                        paddingBottom: insets.bottom + 28,
                    },
                ]}
            >
                <View
                    style={[
                        styles.introCard,
                        {
                            backgroundColor: colors.cardBackground,
                            borderColor: colors.outlineVariant,
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
                        Create a ride offer
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
                            : 'Create a general trip or connect the ride to a public activity.'}
                    </AppText>
                </View>
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
    },
    introCard: {
        borderWidth: 1,
        borderRadius: 20,
        padding: 20,
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
        fontSize: 25,
        fontWeight: '800',
    },
    subtitle: {
        marginTop: 8,
        fontSize: 14,
        lineHeight: 21,
    },
});