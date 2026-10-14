import { Switch, StyleSheet, TouchableOpacity, View } from 'react-native';

import { DateTimeField } from '@/components/post/date-time-field';
import {
  LocationAutocompleteField,
  type PlaceSelection,
} from '@/components/post/location-autocomplete-field';
import { PostField } from '@/components/post/post-field';
import { AppText } from '@/components/text';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type OfferRideFormProps = {
  individualPickup?: boolean;
  onIndividualPickupChange?: (value: boolean) => void;
  pickupLocation: string;
  onPickupLocationChange: (value: string) => void;
  destination: string;
  onDestinationChange: (value: string) => void;
  destinationLocked?: boolean;
  fixedDate?: Date;
  rideDateTime: Date | null;
  onRideDateTimeChange: (date: Date) => void;
  availableSeats?: string;
  onAvailableSeatsChange?: (value: string) => void;
  notes: string;
  onNotesChange: (value: string) => void;
  saving: boolean;
  onSubmit: () => void;
  submitLabel?: string;
  savingLabel?: string;
  pickupPlaceholder?: string;
  destinationPlaceholder?: string;
  notesPlaceholder?: string;
  onPickupPlaceSelect?: (place: PlaceSelection) => void;
  onDestinationPlaceSelect?: (place: PlaceSelection) => void;
};

export function OfferRideForm({
  individualPickup = false,
  onIndividualPickupChange,
  pickupLocation,
  onPickupLocationChange,
  destination,
  onDestinationChange,
  destinationLocked = false,
  fixedDate,
  rideDateTime,
  onRideDateTimeChange,
  availableSeats,
  onAvailableSeatsChange,
  notes,
  onNotesChange,
  saving,
  onSubmit,
  submitLabel = 'Post Ride Offer',
  savingLabel = 'Posting...',
  pickupPlaceholder = 'Where should riders meet you?',
  destinationPlaceholder = 'Where are you headed?',
  notesPlaceholder = 'Car details, meeting spot, anything riders should know...',
  onPickupPlaceSelect,
  onDestinationPlaceSelect,
}: OfferRideFormProps) {
  const theme = useColorScheme() ?? 'light';
  const colors = Colors[theme];

  function handleDateChange(selected: Date) {
    if (fixedDate) return;
    const next = new Date(rideDateTime ?? selected);
    next.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
    onRideDateTimeChange(next);
  }

  function handleTimeChange(selected: Date) {
    const next = new Date(fixedDate ?? rideDateTime ?? selected);
    next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
    onRideDateTimeChange(next);
  }

  return (
    <>
      <View style={styles.section}>
        <AppText style={[styles.sectionHeading, { color: colors.text, fontFamily: Fonts?.sans }]}>
          Trip Details
        </AppText>

        {onIndividualPickupChange && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <AppText style={{ flex: 1 }}>Pick up passengers at their locations</AppText>
          <Switch value={individualPickup} onValueChange={onIndividualPickupChange} accessibilityLabel="Individual passenger pickups" />
        </View>}
        {!individualPickup && <LocationAutocompleteField
          label="Pickup Location"
          value={pickupLocation}
          onChangeText={(text) => { onPickupLocationChange(text); }}
          onPlaceSelect={(place) => { onPickupLocationChange(place.displayText); onPickupPlaceSelect?.(place); }}
          placeholder={pickupPlaceholder}
        />}

        <View style={styles.destinationSection}>
          {destinationLocked ? (
            <PostField
              label="Destination"
              value={destination}
              onChangeText={onDestinationChange}
              placeholder={destinationPlaceholder}
              editable={false}
            />
          ) : (
            <LocationAutocompleteField
              label="Destination"
              value={destination}
              onChangeText={(text) => { onDestinationChange(text); }}
              onPlaceSelect={(place) => { onDestinationChange(place.displayText); onDestinationPlaceSelect?.(place); }}
              placeholder={destinationPlaceholder}
            />
          )}

        </View>

        <View style={styles.row}>
          <View style={styles.rowItem}>
            {fixedDate ? (
              <View style={styles.fixedDateGroup}>
                <AppText style={[styles.dateLabel, { color: colors.text }]}>Date</AppText>
                <View style={[styles.fixedDateField, { backgroundColor: colors.surfaceContainerHigh, borderColor: colors.outlineVariant }]}>
                  <AppText style={[styles.fixedDateText, { color: colors.text }]}>{fixedDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</AppText>
                </View>
              </View>
            ) : <DateTimeField
              label="Date"
              mode="date"
              value={rideDateTime}
              onChange={handleDateChange}
              placeholder="Select date"
              minimumDate={new Date()}
            />}
          </View>

          <View style={styles.rowItem}>
            <DateTimeField
              label="Time"
              mode="time"
              value={rideDateTime}
              onChange={handleTimeChange}
              placeholder="Select time"
            />
          </View>
        </View>

        {onAvailableSeatsChange && (
          <PostField
            label="Available Seats"
            value={availableSeats ?? ''}
            onChangeText={onAvailableSeatsChange}
            placeholder="1"
            keyboardType="numeric"
          />
        )}

        <PostField
          label="Notes (optional)"
          value={notes}
          onChangeText={onNotesChange}
          placeholder={notesPlaceholder}
          multiline
        />
      </View>

      <TouchableOpacity
        onPress={onSubmit}
        disabled={saving}
        style={[styles.submitButton, { backgroundColor: saving ? colors.outline : colors.tint }]}
      >
        <AppText style={[styles.submitText, { color: colors.onImageOverlay, fontFamily: Fonts?.sans }]}>
          {saving ? savingLabel : submitLabel}
        </AppText>
      </TouchableOpacity>
    </>
  );
}

const styles = StyleSheet.create({
  fixedDateGroup: {
    gap: 6,
  },
  dateLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  fixedDateField: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fixedDateText: {
    fontSize: 15,
    textAlign: 'center',
    includeFontPadding: false,
  },
  section: {
    gap: 14,
  },

  sectionHeading: {
    fontSize: 18,
    fontWeight: '700',
  },

  destinationSection: {
    gap: 6,
  },

  row: {
    flexDirection: 'row',
    gap: 12,
  },

  rowItem: {
    flex: 1,
  },

  submitButton: {
    borderRadius: 24,
    paddingVertical: 14,
    alignItems: 'center',
  },

  submitText: {
    fontSize: 16,
    fontWeight: '700',
  },
});
