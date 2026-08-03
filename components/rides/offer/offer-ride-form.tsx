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
  rideDateTime: Date | null;
  onRideDateTimeChange: (date: Date) => void;
  availableSeats: string;
  onAvailableSeatsChange: (value: string) => void;
  notes: string;
  onNotesChange: (value: string) => void;
  saving: boolean;
  onSubmit: () => void;
};

export function OfferRideForm({
  pickupLocation,
  onPickupLocationChange,
  destination,
  onDestinationChange,
  rideDateTime,
  onRideDateTimeChange,
  availableSeats,
  onAvailableSeatsChange,
  notes,
  onNotesChange,
  saving,
  onSubmit,
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
          placeholder="Where should riders meet you?"
        />

        <PostField
          label="Destination"
          value={destination}
          onChangeText={onDestinationChange}
          placeholder="Where are you headed?"
        />

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

        <PostField
          label="Available Seats"
          value={availableSeats}
          onChangeText={onAvailableSeatsChange}
          placeholder="1"
          keyboardType="numeric"
        />

        <PostField
          label="Notes (optional)"
          value={notes}
          onChangeText={onNotesChange}
          placeholder="Car details, meeting spot, anything riders should know..."
          multiline
        />
      </View>

      <TouchableOpacity
        onPress={onSubmit}
        disabled={saving}
        style={[styles.submitButton, { backgroundColor: saving ? colors.outline : colors.tint }]}
      >
        <AppText style={[styles.submitText, { color: colors.onImageOverlay, fontFamily: Fonts?.sans }]}>
          {saving ? 'Posting...' : 'Post Ride Offer'}
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
