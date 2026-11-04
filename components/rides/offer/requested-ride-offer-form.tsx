import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import type { ComponentProps } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

import { PostField } from '@/components/post/post-field';
import { AppText } from '@/components/text';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { WantedRide } from '@/types/rides';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

type RequestedRideOfferFormProps = {
  request: WantedRide;
  availableSeats: string;
  onAvailableSeatsChange: (value: string) => void;
  notes: string;
  onNotesChange: (value: string) => void;
  saving: boolean;
  onSubmit: () => void;
};

/**
 * Offer form for a passenger's ride request. Pickup, destination and time belong to the
 * passenger and are shown read-only; the driver only chooses seats and adds notes.
 */
export function RequestedRideOfferForm({
  request,
  availableSeats,
  onAvailableSeatsChange,
  notes,
  onNotesChange,
  saving,
  onSubmit,
}: RequestedRideOfferFormProps) {
  const theme = useColorScheme() ?? 'light';
  const colors = Colors[theme];
  const firstName = request.requester.name.split(' ')[0];

  const dateLabel = request.dateTime
    ? new Date(request.dateTime).toLocaleString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
    : 'Time not set';

  function renderLockedRow(icon: IconName, label: string, value: string) {
    return (
      <View style={styles.lockedRow}>
        <View style={[styles.rowIcon, { backgroundColor: colors.surfaceContainer }]}>
          <MaterialCommunityIcons name={icon} size={18} color={colors.tint} />
        </View>
        <View style={styles.rowText}>
          <AppText style={[styles.rowLabel, { color: colors.icon, fontFamily: Fonts?.sans }]}>{label}</AppText>
          <AppText style={[styles.rowValue, { color: colors.text, fontFamily: Fonts?.sans }]}>{value}</AppText>
        </View>
        <MaterialCommunityIcons name="lock-outline" size={16} color={colors.tabIconDefault} />
      </View>
    );
  }

  return (
    <>
      <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.outlineVariant }]}>
        <View style={styles.requester}>
          {request.requester.avatarUrl ? (
            <Image source={{ uri: request.requester.avatarUrl }} style={styles.avatar} contentFit="cover" />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: colors.surfaceContainer }]}>
              <MaterialCommunityIcons name="account" size={24} color={colors.icon} />
            </View>
          )}
          <View style={styles.rowText}>
            <AppText style={[styles.requesterName, { color: colors.text, fontFamily: Fonts?.sans }]}>
              {request.requester.name}
            </AppText>
            <AppText style={[styles.rowLabel, { color: colors.icon, fontFamily: Fonts?.sans }]}>
              {request.activity ? `Needs a ride to ${request.activity.title}` : 'Needs a ride'}
            </AppText>
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.outlineVariant }]} />

        {renderLockedRow('map-marker-outline', 'Pickup', request.pickupLocation)}
        {renderLockedRow('flag-checkered', 'Destination', request.destination)}
        {renderLockedRow('clock-outline', 'Departure', dateLabel)}

        {!!request.notes && (
          <View style={[styles.passengerNote, { backgroundColor: colors.surfaceContainer }]}>
            <MaterialCommunityIcons name="message-text-outline" size={16} color={colors.icon} />
            <AppText style={[styles.passengerNoteText, { color: colors.text, fontFamily: Fonts?.sans }]}>
              {request.notes}
            </AppText>
          </View>
        )}

        <AppText style={[styles.hint, { color: colors.icon, fontFamily: Fonts?.sans }]}>
          {firstName} set the pickup, destination and time. Offer the ride to pick them up as requested.
        </AppText>
      </View>

      <View style={styles.fields}>
        <PostField
          label="Seats you're offering"
          value={availableSeats}
          onChangeText={onAvailableSeatsChange}
          placeholder="1"
          keyboardType="numeric"
        />
        <AppText style={[styles.fieldHint, { color: colors.icon, fontFamily: Fonts?.sans }]}>
          Includes {firstName}&apos;s seat. Any extra seats stay open for other riders.
        </AppText>

        <PostField
          label="Notes for the passenger (optional)"
          value={notes}
          onChangeText={onNotesChange}
          placeholder="Car details, where exactly you'll wait..."
          multiline
        />
      </View>

      <TouchableOpacity
        accessibilityRole="button"
        onPress={onSubmit}
        disabled={saving}
        style={[styles.submitButton, { backgroundColor: saving ? colors.outline : colors.tint }]}
      >
        <AppText style={[styles.submitText, { color: colors.onPrimary, fontFamily: Fonts?.sans }]}>
          {saving ? 'Offering...' : `Offer ${firstName} this ride`}
        </AppText>
      </TouchableOpacity>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    gap: 14,
  },
  requester: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  requesterName: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  lockedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
  },
  rowLabel: {
    fontSize: 12,
    lineHeight: 16,
  },
  rowValue: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
  },
  passengerNote: {
    flexDirection: 'row',
    gap: 8,
    borderRadius: 12,
    padding: 12,
  },
  passengerNoteText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  hint: {
    fontSize: 13,
    lineHeight: 18,
  },
  fields: {
    gap: 8,
  },
  fieldHint: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: -2,
    marginBottom: 6,
  },
  submitButton: {
    borderRadius: 24,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitText: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
  },
});
