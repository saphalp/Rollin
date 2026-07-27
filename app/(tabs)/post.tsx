import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  Image,
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
import { supabase } from '@/lib/supabase';

const CATEGORIES = ['Social', 'Sports', 'Music', 'Study', 'Outdoor', 'Gaming', 'Grocery'];

type ActivityCoordinate = {
  latitude: number;
  longitude: number;
};

async function geocodeActivityLocation(
  address: string,
): Promise<ActivityCoordinate | null> {
  try {
    // Expo's native geocoder supports Android and iOS.
    if (Platform.OS === 'web') {
      Alert.alert(
        'Mobile app required',
        'Activity map coordinates are currently created from the iOS or Android app.',
      );
      return null;
    }

    // Android requires foreground location permission before geocoding.
    if (Platform.OS === 'android') {
      const permission =
        await Location.requestForegroundPermissionsAsync();

      if (permission.status !== 'granted') {
        Alert.alert(
          'Location permission required',
          'Allow location access so Roli can place this activity on the map.',
        );
        return null;
      }
    }

    const matches = await Location.geocodeAsync(address);
    const bestMatch = matches[0];

    if (!bestMatch) {
      Alert.alert(
        'Location not found',
        'Enter a more specific location, including the city and state.',
      );
      return null;
    }

    return {
      latitude: bestMatch.latitude,
      longitude: bestMatch.longitude,
    };
  } catch (error) {
    Alert.alert(
      'Location lookup failed',
      error instanceof Error
        ? error.message
        : 'Roli could not find coordinates for this location.',
    );

    return null;
  }
}

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
  const [imageAsset, setImageAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [saving, setSaving] = useState(false);

  async function pickImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission required', 'Photo library access is needed to select an image.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) setImageAsset(result.assets[0]);
  }

  async function uploadImage(userId: string): Promise<string | null> {
    if (!imageAsset) return null;
    const contentType = imageAsset.mimeType ?? 'image/jpeg';
    const ext = contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg';
    const path = `${userId}/${Date.now()}.${ext}`;
    const body = new FormData();
    body.append('file', { uri: imageAsset.uri, name: `image.${ext}`, type: contentType } as any);
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(
      `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/activity-images/${path}`,
      { method: 'POST', headers: { authorization: `Bearer ${session?.access_token}`, 'x-upsert': 'true' }, body }
    );
    if (!res.ok) {
      const msg = await res.text();
      Alert.alert('Photo upload failed', msg);
      return null;
    }
    return supabase.storage.from('activity-images').getPublicUrl(path).data.publicUrl;
  }

  async function handleCreatePost() {
    if (!title.trim()) {
      Alert.alert('Missing title', 'Please enter an activity title.');
      return;
    }
    if (!location.trim()) {
      Alert.alert('Missing location', 'Please enter a location.');
      return;
    }

    setSaving(true);

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      Alert.alert('Not logged in', 'Please log in to create an activity.');
      setSaving(false);
      return;
    }

    const activityCoordinate =
      await geocodeActivityLocation(location.trim());

    if (!activityCoordinate) {
      setSaving(false);
      return;
    }

    const imageUrl = await uploadImage(user.id);

    let dateTime: string | null = null;
    if (date.trim() && time.trim()) {
      const parsed = new Date(`${date.trim()} ${time.trim()}`);
      if (!isNaN(parsed.getTime())) dateTime = parsed.toISOString();
    }

    const { error } = await supabase.from('activities').insert({
      host_id: user.id,
      title: title.trim(),
      category: category.toLowerCase(),
      description: description.trim() || null,
      image_url: imageUrl,
      location: location.trim(),
      latitude: activityCoordinate.latitude,
      longitude: activityCoordinate.longitude,
      date_time: dateTime,
      max_attendees: maxAttendees ? parseInt(maxAttendees) : 10,
      rides_available: ridesAvailable ? (rideSeats ? parseInt(rideSeats) : 1) : 0,
    });

    setSaving(false);

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

    setTitle('');
    setCategory('Social');
    setDescription('');
    setLocation('');
    setDate('');
    setTime('');
    setMaxAttendees('');
    setRidesAvailable(false);
    setRideSeats('');
    setImageAsset(null);

    router.replace('/(tabs)');
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
              placeholder="Lambright Sports Center, Ruston, LA"
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

          {/* Image */}
          <View style={[styles.imageSection, { borderColor: colors.outlineVariant, backgroundColor: colors.cardBackground }]}>
            <AppText style={[styles.fieldLabel, { color: colors.text, fontFamily: Fonts?.sans }]}>
              Activity Photo
            </AppText>
            {imageAsset ? (
              <TouchableOpacity onPress={pickImage} activeOpacity={0.85}>
                <Image source={{ uri: imageAsset.uri }} style={styles.imagePreview} resizeMode="cover" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={pickImage}
                style={[styles.imagePlaceholder, { borderColor: colors.outline }]}
              >
                <IconSymbol name="plus" size={28} color={colors.outline} />
                <AppText style={[styles.imagePlaceholderText, { color: colors.outline, fontFamily: Fonts?.sans }]}>
                  Tap to add a photo
                </AppText>
              </TouchableOpacity>
            )}
          </View>

          {/* Submit */}
          <TouchableOpacity
            onPress={handleCreatePost}
            disabled={saving}
            style={[styles.submitButton, { backgroundColor: saving ? colors.outline : colors.tint }]}
          >
            <AppText
              style={[styles.submitText, { color: colors.onImageOverlay, fontFamily: Fonts?.sans }]}
            >
              {saving ? 'Creating...' : 'Create Activity'}
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
  imageSection: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    gap: 12,
  },
  imagePlaceholder: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 12,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  imagePlaceholderText: {
    fontSize: 14,
  },
  imagePreview: {
    width: '100%',
    height: 180,
    borderRadius: 12,
  },
});