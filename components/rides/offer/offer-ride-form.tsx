import { StyleSheet, TouchableOpacity, View } from 'react-native';

import { DateTimeField } from '@/components/post/date-time-field';
import { PostField } from '@/components/post/post-field';
import { AppText } from '@/components/text';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type OfferRideFormProps = {
  pickupLocation: string;
  onPickupLocationChange: (value: string) => void;
  destination: string;
  onDestinationChange: (value: string) => void;
  destinationLocked?: boolean;
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
};

export function OfferRideForm({
  pickupLocation,
  onPickupLocationChange,
  destination,
  onDestinationChange,
  destinationLocked = false,
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
}: OfferRideFormProps) {
  const theme = useColorScheme() ?? 'light';
  const colors = Colors[theme];

  function handleDateChange(selected: Date) {
    const next = new Date(rideDateTime ?? selected);
    next.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
    onRideDateTimeChange(next);
  }

  function handleTimeChange(selected: Date) {
    const next = new Date(rideDateTime ?? selected);
    next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
    onRideDateTimeChange(next);
  }

  return (
    <>
      <View style={styles.section}>
        <AppText style={[styles.sectionHeading, { color: colors.text, fontFamily: Fonts?.sans }]}>
          Trip Details
        </AppText>

        <PostField
          label="Pickup Location"
          value={pickupLocation}
          onChangeText={onPickupLocationChange}
          placeholder={pickupPlaceholder}
        />

        <View style={styles.destinationSection}>
          <PostField
            label="Destination"
            value={destination}
            onChangeText={onDestinationChange}
            placeholder={destinationPlaceholder}
            editable={!destinationLocked}
          />

          {destinationLocked && (
            <AppText
              style={[
                styles.lockedDestinationText,
                {
                  color: colors.outline,
                  fontFamily: Fonts?.sans,
                },
              ]}
            >
              Destination is fixed for this activity.
            </AppText>
          )}
        </View>

        <View style={styles.row}>
          <View style={styles.rowItem}>
            <DateTimeField
              label="Date"
              mode="date"
              value={rideDateTime}
              onChange={handleDateChange}
              placeholder="Select date"
              minimumDate={new Date()}
            />
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

  lockedDestinationText: {
    fontSize: 12,
    lineHeight: 16,
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