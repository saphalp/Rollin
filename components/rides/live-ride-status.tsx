import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/text';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type Props = {
    distanceKm: number | null;
    etaMinutes: number | null;
    arrived: boolean;
    stale: boolean;
};

export function LiveRideStatus({
    distanceKm,
    etaMinutes,
    arrived,
    stale,
}: Props) {
    const theme = useColorScheme() ?? 'light';
    const colors = Colors[theme];

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
            <View style={styles.statusHeader}>
                <MaterialCommunityIcons
                    name={
                        arrived
                            ? 'map-marker-check'
                            : stale
                                ? 'wifi-alert'
                                : 'crosshairs-gps'
                    }
                    size={24}
                    color={arrived ? colors.tint : colors.icon}
                />
                <View style={styles.statusText}>
                    <AppText
                        style={[
                            styles.title,
                            {
                                color: colors.text,
                                fontFamily: Fonts?.sans,
                            },
                        ]}
                    >
                        {arrived
                            ? 'Driver has arrived'
                            : stale
                                ? 'Waiting for a fresh location'
                                : 'Driver is on the way'}
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
                        {arrived
                            ? 'The driver is within about 100 meters.'
                            : 'Distance and ETA update as the driver moves.'}
                    </AppText>
                </View>
            </View>

            <View style={styles.metrics}>
                <View
                    style={[
                        styles.metric,
                        {
                            backgroundColor: colors.surfaceContainer,
                        },
                    ]}
                >
                    <AppText
                        style={[
                            styles.metricValue,
                            {
                                color: colors.text,
                                fontFamily: Fonts?.sans,
                            },
                        ]}
                    >
                        {distanceKm == null
                            ? '--'
                            : distanceKm < 1
                                ? `${Math.round(distanceKm * 1000)} m`
                                : `${distanceKm.toFixed(1)} km`}
                    </AppText>
                    <AppText
                        style={[
                            styles.metricLabel,
                            {
                                color: colors.icon,
                                fontFamily: Fonts?.sans,
                            },
                        ]}
                    >
                        Distance
                    </AppText>
                </View>

                <View
                    style={[
                        styles.metric,
                        {
                            backgroundColor: colors.surfaceContainer,
                        },
                    ]}
                >
                    <AppText
                        style={[
                            styles.metricValue,
                            {
                                color: colors.text,
                                fontFamily: Fonts?.sans,
                            },
                        ]}
                    >
                        {etaMinutes == null ? '--' : `${etaMinutes} min`}
                    </AppText>
                    <AppText
                        style={[
                            styles.metricLabel,
                            {
                                color: colors.icon,
                                fontFamily: Fonts?.sans,
                            },
                        ]}
                    >
                        Approx. ETA
                    </AppText>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        borderWidth: 1,
        borderRadius: 20,
        padding: 16,
        gap: 16,
    },
    statusHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 11,
    },
    statusText: {
        flex: 1,
    },
    title: {
        fontSize: 16,
        fontWeight: '800',
    },
    subtitle: {
        marginTop: 3,
        fontSize: 12,
        lineHeight: 18,
    },
    metrics: {
        flexDirection: 'row',
        gap: 10,
    },
    metric: {
        flex: 1,
        borderRadius: 15,
        padding: 13,
    },
    metricValue: {
        fontSize: 18,
        fontWeight: '900',
    },
    metricLabel: {
        marginTop: 3,
        fontSize: 11,
    },
});
