
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import type { Region } from 'react-native-maps';
import MapView, { Marker } from 'react-native-maps';

import { AppText } from '@/components/text';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

// Default location: Louisiana Tech University
const DEFAULT_REGION: Region = {
  latitude: 32.5299586,
  longitude: -92.6522165,
  latitudeDelta: 0.04,
  longitudeDelta: 0.04,
};

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

  // Use Louisiana Tech when GPS is unavailable
  const mapRegion = region ?? DEFAULT_REGION;
  const hasUserLocation = region !== null;

  return (
    <View
      style={[
        styles.mapCard,
        {
          backgroundColor: colors.cardBackground,
          borderColor: colors.outlineVariant,
        },
      ]}
    >
      {/* Map Header */}
      <View style={styles.mapHeader}>
        <View style={styles.mapHeaderText}>
          <AppText
            style={[
              styles.sectionTitle,
              {
                color: colors.text,
                fontFamily: Fonts?.sans,
              },
            ]}
          >
            Nearby rides and activities
          </AppText>

          <AppText
            style={[
              styles.sectionSubtitle,
              {
                color: colors.icon,
                fontFamily: Fonts?.sans,
              },
            ]}
          >
            Public activity locations and ride offers will appear here.
          </AppText>
        </View>

        <MaterialCommunityIcons
          name="map-marker-radius-outline"
          size={24}
          color={colors.tint}
        />
      </View>

      {/* Map Container */}
      <View style={styles.mapContainer}>
        <MapView
          style={StyleSheet.absoluteFill}
          initialRegion={mapRegion}
          showsUserLocation={hasUserLocation}
          showsMyLocationButton={hasUserLocation}
        >
          {/* Show university marker when GPS is unavailable */}
          {!hasUserLocation && (
            <Marker
              coordinate={{
                latitude: DEFAULT_REGION.latitude,
                longitude: DEFAULT_REGION.longitude,
              }}
              title="Louisiana Tech University"
              description="Default map location"
              pinColor={colors.tint}
            />
          )}
        </MapView>

        {/* Non-blocking location loading message */}
        {loadingLocation && (
          <View
            style={[
              styles.loadingBadge,
              {
                backgroundColor: colors.cardBackground,
                borderColor: colors.outlineVariant,
              },
            ]}
          >
            <ActivityIndicator
              size="small"
              color={colors.tint}
            />

            <AppText
              style={[
                styles.loadingText,
                {
                  color: colors.text,
                  fontFamily: Fonts?.sans,
                },
              ]}
            >
              Checking location...
            </AppText>
          </View>
        )}

        {/* Location unavailable message */}
        {!loadingLocation && !hasUserLocation && (
          <View
            style={[
              styles.locationBadge,
              {
                backgroundColor: colors.cardBackground,
                borderColor: colors.outlineVariant,
              },
            ]}
          >
            <MaterialCommunityIcons
              name="map-marker-outline"
              size={17}
              color={colors.tint}
            />

            <AppText
              numberOfLines={2}
              style={[
                styles.locationText,
                {
                  color: colors.text,
                  fontFamily: Fonts?.sans,
                },
              ]}
            >
              Showing Louisiana Tech University
            </AppText>
          </View>
        )}
      </View>

      {/* Expand Map Button */}
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Open full screen map"
        onPress={onExpand}
        style={[
          styles.expandMapButton,
          {
            backgroundColor: colors.cardBackground,
            borderColor: colors.outlineVariant,
          },
        ]}
      >
        <MaterialCommunityIcons
          name="arrow-expand"
          size={22}
          color={colors.tint}
        />
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

  loadingBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderRadius: 12,
  },

  loadingText: {
    fontSize: 12,
    fontWeight: '500',
  },

  locationBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderRadius: 12,
  },

  locationText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '500',
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
