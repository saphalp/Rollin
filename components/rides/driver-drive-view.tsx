import { useState } from 'react';
import { Modal, ScrollView, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import LiveRideMap from '@/components/rides/live-ride-map';
import { AppText } from '@/components/text';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { RoadRoute, formatMiles } from '@/services/ride-routing-service';
import { Coordinates, RideLocation } from '@/types/rides';

type Props = {
    route: RoadRoute;
    driverLocation: RideLocation | null;
    pickup: Coordinates | null;
    destination: Coordinates | null;
    onClose: () => void;
};

export function DriverDriveView({ route, driverLocation, pickup, destination, onClose }: Props) {
    const [showDirections, setShowDirections] = useState(false);
    const insets = useSafeAreaInsets();
    const colors = Colors[useColorScheme() ?? 'light'];
    return (
        <Modal
            visible
            animationType="slide"
            presentationStyle="fullScreen"
            transparent={false}
            backdropColor={colors.background}
            statusBarTranslucent
            navigationBarTranslucent
            onRequestClose={onClose}
        >
            <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top, paddingBottom: insets.bottom }}>
                <View style={{ padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <TouchableOpacity accessibilityRole="button" accessibilityLabel="Exit full-screen map" onPress={onClose} style={{ padding: 8 }}>
                        <MaterialCommunityIcons name="arrow-left" color={colors.text} size={26} />
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                        <AppText style={{ fontWeight: '700', fontSize: 18 }}>Your drive</AppText>
                        <AppText>{formatMiles(route.distanceMeters)} · {Math.max(1, Math.ceil(route.durationSeconds / 60))} min total</AppText>
                    </View>
                    <TouchableOpacity accessibilityRole="button" onPress={() => setShowDirections(!showDirections)} style={{ padding: 8 }}>
                        <AppText style={{ color: colors.tint }}>{showDirections ? 'Hide steps' : 'Directions'}</AppText>
                    </TouchableOpacity>
                </View>
                <LiveRideMap fullScreen routeCoordinates={route.coordinates} driverLocation={driverLocation}
                    passengerLocation={null} pickup={pickup} destination={destination} />
                {showDirections ? <ScrollView style={{ maxHeight: 260 }} contentContainerStyle={{ padding: 16, gap: 14 }}>
                    <AppText style={{ fontWeight: '700' }}>Route directions</AppText>
                    <AppText style={{ fontSize: 12 }}>Full itinerary. Voice guidance and automatic rerouting are not enabled.</AppText>
                    {route.steps?.length ? route.steps.map((step, index) => <View key={index} style={{ gap: 3 }}>
                        <AppText>{index + 1}. {step.instruction}</AppText>
                        <AppText style={{ color: colors.icon }}>{formatMiles(step.distanceMeters)}</AppText>
                    </View>) : <AppText>Directions are unavailable for this saved route. Update the routing function and refresh the route.</AppText>}
                </ScrollView> : null}
                <AppText style={{ padding: 10, fontSize: 11 }}>Routing © openrouteservice · © OpenStreetMap contributors</AppText>
            </View>
        </Modal>
    );
}
