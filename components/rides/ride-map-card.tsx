import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from 'react-native';
import type { Region } from 'react-native-maps';
import MapView, { Marker } from 'react-native-maps';

import { AppText } from '@/components/text';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type RideMapCardProps = {
  region: Region | null;
  loadingLocation: boolean;
  locationError: string | null;
  onRetry: () => void;
  onExpand: () => void;
};

export function RideMapCard({
  region,
  loadingLocation,
  locationError,
  onRetry,
  onExpand,
}: RideMapCardProps) {
  const theme = useColorScheme() ?? 'light';
  const colors = Colors[theme];

  return (
    <View
      style={[styles.mapCard, { backgroundColor: colors.cardBackground, borderColor: colors.outlineVariant }]}
    >
      <View style={styles.mapHeader}>
        <View style={styles.mapHeaderText}>
          <AppText style={[styles.sectionTitle, { color: colors.text, fontFamily: Fonts?.sans }]}>
            Nearby rides and activities
          </AppText>

          <AppText style={[styles.sectionSubtitle, { color: colors.icon, fontFamily: Fonts?.sans }]}>
            Public activity locations and ride offers will appear here.
          </AppText>
        </View>

        <MaterialCommunityIcons name="map-marker-radius-outline" size={24} color={colors.tint} />
      </View>

      <View style={styles.mapContainer}>
        {loadingLocation && (
          <View style={[styles.mapStatus, { backgroundColor: colors.surfaceContainerHigh }]}>
            <ActivityIndicator size="large" color={colors.tint} />

            <AppText style={[styles.mapStatusText, { color: colors.icon, fontFamily: Fonts?.sans }]}>
              Loading your location
            </AppText>
          </View>
        )}

        {!loadingLocation && region && (
          <MapView style={StyleSheet.absoluteFill} initialRegion={region} showsUserLocation showsMyLocationButton>
            <Marker
              coordinate={{ latitude: region.latitude, longitude: region.longitude }}
              title="Your location"
              description="Current area"
              pinColor={colors.tint}
            />
          </MapView>
        )}

        {!loadingLocation && !region && (
          <View style={[styles.mapStatus, { backgroundColor: colors.surfaceContainerHigh }]}>
            <MaterialCommunityIcons name="map-marker-off-outline" size={34} color={colors.icon} />

            <AppText style={[styles.mapErrorTitle, { color: colors.text, fontFamily: Fonts?.sans }]}>
              Map unavailable
            </AppText>

            <AppText style={[styles.mapStatusText, { color: colors.icon, fontFamily: Fonts?.sans }]}>
              {locationError ?? 'Your current location could not be loaded.'}
            </AppText>

            <TouchableOpacity
              accessibilityRole="button"
              onPress={onRetry}
              style={[styles.retryButton, { borderColor: colors.tint }]}
            >
              <AppText style={[styles.retryButtonText, { color: colors.tint, fontFamily: Fonts?.sans }]}>
                Try Again
              </AppText>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Open full screen map"
        onPress={onExpand}
        style={[styles.expandMapButton, { backgroundColor: colors.cardBackground, borderColor: colors.outlineVariant }]}
      >
        <MaterialCommunityIcons name="arrow-expand" size={22} color={colors.tint} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  mapCard: {
    position: 'relative',
    borderWidth: 1,
    borderRadius: 20,
    padding: 14,
    gap: 12,
  },
  mapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  mapHeaderText: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  sectionSubtitle: {
    marginTop: 2,
    fontSize: 13,
    lineHeight: 18,
  },
  mapContainer: {
    height: 265,
    overflow: 'hidden',
    borderRadius: 16,
  },
  mapStatus: {
    flex: 1,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapErrorTitle: {
    marginTop: 10,
    fontSize: 16,
    fontWeight: '700',
  },
  mapStatusText: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 14,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  expandMapButton: {
    position: 'absolute',
    right: 24,
    bottom: 24,
    width: 46,
    height: 46,
    borderWidth: 1,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
