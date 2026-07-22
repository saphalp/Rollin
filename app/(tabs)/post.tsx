import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PostField } from '@/components/post/post-field';
import { AppText } from '@/components/text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { AppView } from '@/components/view';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

const CATEGORIES = ['Social', 'Sports', 'Music', 'Study', 'Outdoor', 'Gaming', 'Grocery'];

export default function PostScreen() {
  const theme = useColorScheme() ?? 'light';
  const colors = Colors[theme];
  const insets = useSafeAreaInsets();

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Social');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [maxAttendees, setMaxAttendees] = useState('');
  const [ridesAvailable, setRidesAvailable] = useState(false);
  const [rideSeats, setRideSeats] = useState('');

  function handleCreatePost() {
    if (!title.trim()) {
      Alert.alert('Missing title', 'Please enter an activity title.');
      return;
    }

    if (!location.trim()) {
      Alert.alert('Missing location', 'Please enter a location.');
      return;
    }

    const activityDraft = {
      title,
      category,
      description,
      location,
      date,
      time,
      maxAttendees,
      ridesAvailable,
      rideSeats: ridesAvailable ? rideSeats : '',
    };

    console.log('Activity draft:', activityDraft);

    Alert.alert('Activity created', 'This activity is ready to be saved later.');
  }

  return (
    <AppView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
      >
        <ScrollView
          style={{ backgroundColor: colors.background }}
          contentContainerStyle={[
            styles.content,
            {
              paddingBottom: insets.bottom + 120,
            },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {/* Header */}
          <View style={styles.header}>
            <View>
              <AppText style={[styles.title, { color: colors.text, fontFamily: Fonts?.sans }]}>
                Create Activity
              </AppText>

              <AppText style={[styles.subtitle, { color: colors.outline, fontFamily: Fonts?.sans }]}>
                Tell people what you&apos;re doing.
              </AppText>
            </View>

            <View style={[styles.headerIcon, { backgroundColor: colors.primaryContainer }]}>
              <IconSymbol name="plus" size={24} color={colors.tint} />
            </View>
          </View>

          {/* Main details */}
          <View style={styles.section}>
            <AppText style={[styles.sectionHeading, { color: colors.text, fontFamily: Fonts?.sans }]}>
              Activity Details
            </AppText>

            <PostField
              label="Activity Title"
              value={title}
              onChangeText={setTitle}
              placeholder="Board game night, pickleball, grocery run..."
            />

            <View style={styles.categorySection}>
              <AppText style={[styles.fieldLabel, { color: colors.text, fontFamily: Fonts?.sans }]}>
                Category
              </AppText>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoryList}
                keyboardShouldPersistTaps="handled"
              >
                {CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    onPress={() => setCategory(cat)}
                    style={[
                      styles.categoryPill,
                      category === cat
                        ? { backgroundColor: colors.tint, borderColor: colors.tint }
                        : { backgroundColor: 'transparent', borderColor: colors.outline },
                    ]}
                  >
                    <AppText
                      style={[
                        styles.categoryText,
                        {
                          color: category === cat ? colors.onImageOverlay : colors.text,
                          fontFamily: Fonts?.sans,
                        },
                      ]}
                    >
                      {cat}
                    </AppText>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <PostField
              label="Description"
              value={description}
              onChangeText={setDescription}
              placeholder="Add details people should know..."
              multiline
            />

            <PostField
              label="Location"
              value={location}
              onChangeText={setLocation}
              placeholder="Lambright, Starbucks, Walmart..."
            />
          </View>

          {/* Time/details */}
          <View style={styles.section}>
            <AppText style={[styles.sectionHeading, { color: colors.text, fontFamily: Fonts?.sans }]}>
              Time and Capacity
            </AppText>

            <View style={styles.row}>
              <View style={styles.rowItem}>
                <PostField
                  label="Date"
                  value={date}
                  onChangeText={setDate}
                  placeholder="Fri, Jul 12"
                />
              </View>

              <View style={styles.rowItem}>
                <PostField
                  label="Time"
                  value={time}
                  onChangeText={setTime}
                  placeholder="7:00 PM"
                />
              </View>
            </View>

            <PostField
              label="Max Attendees"
              value={maxAttendees}
              onChangeText={setMaxAttendees}
              placeholder="10"
              keyboardType="numeric"
            />
          </View>

          {/* Ride sharing */}
          <View
            style={[
              styles.rideCard,
              {
                backgroundColor: colors.cardBackground,
                borderColor: colors.outlineVariant,
              },
            ]}
          >
            <View style={styles.rideHeader}>
              <View style={styles.rideTextContainer}>
                <AppText style={[styles.rideTitle, { color: colors.text, fontFamily: Fonts?.sans }]}>
                  Ride sharing
                </AppText>

                <AppText style={[styles.rideSubtitle, { color: colors.outline, fontFamily: Fonts?.sans }]}>
                  Let others know if rides are available.
                </AppText>
              </View>

              <TouchableOpacity
                onPress={() => setRidesAvailable((current) => !current)}
                style={[
                  styles.toggleButton,
                  ridesAvailable
                    ? { backgroundColor: colors.tint }
                    : { backgroundColor: colors.surfaceContainerHigh },
                ]}
              >
                <AppText
                  style={[
                    styles.toggleText,
                    {
                      color: ridesAvailable ? colors.onImageOverlay : colors.text,
                      fontFamily: Fonts?.sans,
                    },
                  ]}
                >
                  {ridesAvailable ? 'Yes' : 'No'}
                </AppText>
              </TouchableOpacity>
            </View>

            {ridesAvailable && (
              <PostField
                label="Available Seats"
                value={rideSeats}
                onChangeText={setRideSeats}
                placeholder="3"
                keyboardType="numeric"
              />
            )}
          </View>

          {/* Submit */}
          <TouchableOpacity
            onPress={handleCreatePost}
            style={[styles.submitButton, { backgroundColor: colors.tint }]}
          >
            <AppText
              style={[
                styles.submitText,
                {
                  color: colors.onImageOverlay,
                  fontFamily: Fonts?.sans,
                },
              ]}
            >
              Create Activity
            </AppText>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </AppView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    gap: 18,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 14,
    marginTop: 2,
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: {
    gap: 14,
  },
  sectionHeading: {
    fontSize: 18,
    fontWeight: '700',
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  categorySection: {
    gap: 8,
  },
  categoryList: {
    gap: 8,
    paddingRight: 16,
  },
  categoryPill: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '500',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  rowItem: {
    flex: 1,
  },
  rideCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    gap: 14,
  },
  rideHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  rideTextContainer: {
    flex: 1,
  },
  rideTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  rideSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  toggleButton: {
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '700',
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