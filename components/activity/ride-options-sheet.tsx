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
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: 42,
    },

    handle: {
        width: 48,
        height: 5,
        borderRadius: 3,
        alignSelf: 'center',
        marginBottom: 22,
    },

    title: {
        fontSize: 26,
        fontWeight: '800',
    },

    subtitle: {
        fontSize: 15,
        lineHeight: 21,
        marginTop: 6,
        marginBottom: 22,
    },

    options: {
        flexDirection: 'row',
        gap: 14,
    },

    optionCard: {
        flex: 1,
        minHeight: 220,
        borderRadius: 22,
        borderWidth: 1,
        padding: 18,
    },

    findCard: {
        borderWidth: 0,
    },

    findIcon: {
        width: 58,
        height: 58,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fff',
        marginBottom: 22,
    },

    offerIcon: {
        width: 58,
        height: 58,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 22,
    },

    optionTitle: {
        fontSize: 21,
        fontWeight: '800',
        marginBottom: 10,
    },

    optionDescription: {
        fontSize: 15,
        lineHeight: 21,
    },
});