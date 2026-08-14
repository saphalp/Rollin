import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/text';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Coordinates, RideLocation } from '@/types/rides';

type Props = {
    driverLocation: RideLocation | null;
    passengerLocation: Coordinates | null;
    pickup: Coordinates | null;
    destination: Coordinates | null;
};

function formatCoordinates(value: Coordinates | null): string {
    return value
        ? `${value.latitude.toFixed(5)}, ${value.longitude.toFixed(5)}`
        : 'Unavailable';
}

export default function LiveRideMap({
    driverLocation,
    passengerLocation,
    pickup,
    destination,
}: Props) {
    const theme = useColorScheme() ?? 'light';
    const colors = Colors[theme];

    const driver = driverLocation
        ? {
            latitude: driverLocation.latitude,
            longitude: driverLocation.longitude,
        }
        : null;

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
            <MaterialCommunityIcons
                name="map-outline"
                size={42}
                color={colors.tint}
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
                Live map is available on iOS and Android
            </AppText>
            <AppText
                style={[
                    styles.row,
                    {
                        color: colors.icon,
                        fontFamily: Fonts?.sans,
                    },
                ]}
            >
                Driver: {formatCoordinates(driver)}
            </AppText>
            <AppText
                style={[
                    styles.row,
                    {
                        color: colors.icon,
                        fontFamily: Fonts?.sans,
                    },
                ]}
            >
                Passenger: {formatCoordinates(passengerLocation)}
            </AppText>
            <AppText
                style={[
                    styles.row,
                    {
                        color: colors.icon,
                        fontFamily: Fonts?.sans,
                    },
                ]}
            >
                Pickup: {formatCoordinates(pickup)}
            </AppText>
            <AppText
                style={[
                    styles.row,
                    {
                        color: colors.icon,
                        fontFamily: Fonts?.sans,
                    },
                ]}
            >
                Destination: {formatCoordinates(destination)}
            </AppText>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        minHeight: 300,
        borderWidth: 1,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
    },
    title: {
        marginTop: 12,
        marginBottom: 14,
        fontSize: 18,
        fontWeight: '700',
        textAlign: 'center',
    },
    row: {
        marginTop: 5,
        fontSize: 12,
        textAlign: 'center',
    },
});
