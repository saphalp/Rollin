import { router } from 'expo-router';
import {
    Modal,
    Pressable,
    StyleSheet,
    TouchableOpacity,
    View,
} from 'react-native';

import { AppText } from '@/components/text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type Props = {
    visible: boolean;
    activityId: string;
    onClose: () => void;
};

export function RideOptionsSheet({
    visible,
    activityId,
    onClose,
}: Props) {
    const theme = useColorScheme() ?? 'light';
    const colors = Colors[theme];

    function handleFindRide() {
        onClose();

        router.push({
            pathname: '/ride/available',
            params: {
                activityId,
                rideType: 'activity',
            },
        });
    }

    function handleOfferRide() {
        onClose();

        router.push({
            pathname: '/ride/offer',
            params: {
                activityId,
            },
        });
    }

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <View style={styles.container}>
                <Pressable
                    style={styles.backdrop}
                    onPress={onClose}
                />

                <View
                    style={[
                        styles.sheet,
                        {
                            backgroundColor: colors.background,
                        },
                    ]}
                >
                    <View
                        style={[
                            styles.handle,
                            {
                                backgroundColor:
                                    colors.outlineVariant,
                            },
                        ]}
                    />

                    <AppText
                        style={[
                            styles.title,
                            {
                                color: colors.text,
                                fontFamily: Fonts?.sans,
                            },
                        ]}
                    >
                        Ride sharing
                    </AppText>

                    <AppText
                        style={[
                            styles.subtitle,
                            {
                                color: colors.outline,
                                fontFamily: Fonts?.sans,
                            },
                        ]}
                    >
                        Find a ride to this activity, or offer your own seats.
                    </AppText>

                    <View style={styles.options}>
                        {/* FIND RIDE */}

                        <TouchableOpacity
                            activeOpacity={0.9}
                            onPress={handleFindRide}
                            style={[
                                styles.optionCard,
                                styles.findCard,
                                {
                                    backgroundColor:
                                        colors.tint,
                                },
                            ]}
                        >
                            <View style={styles.findIcon}>
                                <IconSymbol
                                    name="car.fill"
                                    size={28}
                                    color={colors.tint}
                                />
                            </View>

                            <AppText
                                style={[
                                    styles.optionTitle,
                                    {
                                        color: '#fff',
                                        fontFamily:
                                            Fonts?.sans,
                                    },
                                ]}
                            >
                                Find a Ride
                            </AppText>

                            <AppText
                                style={[
                                    styles.optionDescription,
                                    {
                                        color:
                                            'rgba(255,255,255,0.88)',
                                        fontFamily:
                                            Fonts?.sans,
                                    },
                                ]}
                            >
                                Search available rides for this activity.
                            </AppText>
                        </TouchableOpacity>

                        {/* OFFER RIDE */}

                        <TouchableOpacity
                            activeOpacity={0.9}
                            onPress={handleOfferRide}
                            style={[
                                styles.optionCard,
                                {
                                    backgroundColor:
                                        colors.cardBackground,
                                    borderColor:
                                        colors.outlineVariant,
                                },
                            ]}
                        >
                            <View
                                style={[
                                    styles.offerIcon,
                                    {
                                        backgroundColor:
                                            colors.tint,
                                    },
                                ]}
                            >
                                <IconSymbol
                                    name="car.fill"
                                    size={28}
                                    color="#fff"
                                />
                            </View>

                            <AppText
                                style={[
                                    styles.optionTitle,
                                    {
                                        color: colors.text,
                                        fontFamily:
                                            Fonts?.sans,
                                    },
                                ]}
                            >
                                Offer a Ride
                            </AppText>

                            <AppText
                                style={[
                                    styles.optionDescription,
                                    {
                                        color:
                                            colors.outline,
                                        fontFamily:
                                            Fonts?.sans,
                                    },
                                ]}
                            >
                                Share your available seats with people attending.
                            </AppText>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'flex-end',
    },

    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor:
            'rgba(0,0,0,0.25)',
    },

    sheet: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: 18,
        paddingTop: 10,
        paddingBottom: 24,
    },

    handle: {
        width: 42,
        height: 4,
        borderRadius: 3,
        alignSelf: 'center',
        marginBottom: 16,
    },

    title: {
        fontSize: 22,
        fontWeight: '800',
    },

    subtitle: {
        fontSize: 14,
        lineHeight: 19,
        marginTop: 4,
        marginBottom: 16,
    },

    options: {
        flexDirection: 'row',
        gap: 12,
    },

    optionCard: {
        flex: 1,
        minHeight: 150,
        borderRadius: 18,
        borderWidth: 1,
        padding: 14,
    },

    findIcon: {
        width: 46,
        height: 46,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fff',
        marginBottom: 14,
    },

    offerIcon: {
        width: 46,
        height: 46,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 14,
    },

    optionTitle: {
        fontSize: 18,
        fontWeight: '800',
        marginBottom: 6,
    },

    optionDescription: {
        fontSize: 13,
        lineHeight: 18,
    },
});