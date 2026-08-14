import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
import { supabase } from '@/lib/supabase';

const CATEGORIES = ['Social', 'Sports', 'Music', 'Study', 'Outdoor', 'Gaming', 'Grocery'];

const CATEGORY_IMAGES: Record<string, string> = {
  social: 'https://picsum.photos/seed/social/900/500',
  sports: 'https://picsum.photos/seed/sports/900/500',
  music: 'https://picsum.photos/seed/music/900/500',
  study: 'https://picsum.photos/seed/study/900/500',
  outdoor: 'https://picsum.photos/seed/outdoor/900/500',
  gaming: 'https://picsum.photos/seed/gaming/900/500',
  grocery: 'https://picsum.photos/seed/grocery/900/500',
};

export default function EditActivityScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useColorScheme() ?? 'light';
  const colors = Colors[theme];
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Social');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [maxAttendees, setMaxAttendees] = useState('');
  const [rideSharing, setRideSharing] = useState(false);
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);
  const [newAsset, setNewAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);

  useEffect(() => {
    if (id) loadActivity();
  }, [id]);

  async function loadActivity() {
    const { data, error } = await supabase
      .from('activities')
      .select(
        'title, category, description, location, date_time, max_attendees, ride_sharing, image_url, host_id'
      )
      .eq('id', id)
      .single();

    if (error || !data) {
      console.error('Edit activity load error:', error);

      Alert.alert(
        'Could not load activity',
        error?.message ?? 'Activity could not be loaded.',
      );

      router.back();
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (user?.id !== data.host_id) {
      Alert.alert('Unauthorized', 'You can only edit your own activities.');
      router.back();
      return;
    }

    setTitle(data.title ?? '');
    setCategory(data.category ? data.category.charAt(0).toUpperCase() + data.category.slice(1) : 'Social');
    setDescription(data.description ?? '');
    setLocation(data.location ?? '');
    setExistingImageUrl(data.image_url ?? null);

    if (data.date_time) {
      const dt = new Date(data.date_time);
      setDate(dt.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' }));
      setTime(dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }));
    }

    setMaxAttendees(data.max_attendees ? String(data.max_attendees) : '');
    setRideSharing(Boolean(data.ride_sharing));

    setLoading(false);
  }

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
    if (!result.canceled && result.assets[0]) setNewAsset(result.assets[0]);
  }

  async function uploadImage(userId: string): Promise<string | null> {
    if (!newAsset) return existingImageUrl;
    const contentType = newAsset.mimeType ?? 'image/jpeg';
    const ext = contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg';
    const path = `${userId}/${Date.now()}.${ext}`;
    const body = new FormData();
    body.append('file', { uri: newAsset.uri, name: `image.${ext}`, type: contentType } as any);
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(
      `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/activity-images/${path}`,
      { method: 'POST', headers: { authorization: `Bearer ${session?.access_token}`, 'x-upsert': 'true' }, body }
    );
    if (!res.ok) {
      const msg = await res.text();
      Alert.alert('Photo upload failed', msg);
      return existingImageUrl;
    }
    return supabase.storage.from('activity-images').getPublicUrl(path).data.publicUrl;
  }

  async function handleSave() {
    if (!title.trim()) {
      Alert.alert('Missing title', 'Please enter an activity title.');
      return;
    }

    setSaving(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      Alert.alert('Not logged in');
      setSaving(false);
      return;
    }

    const imageUrl = await uploadImage(user.id);

    let dateTime: string | null = null;
    if (date.trim() && time.trim()) {
      const parsed = new Date(`${date.trim()} ${time.trim()}`);
      if (!isNaN(parsed.getTime())) dateTime = parsed.toISOString();
    }

    const { data: updatedActivity, error } = await supabase
      .from('activities')
      .update({
        title: title.trim(),
        category: category.toLowerCase(),
        description: description.trim() || null,
        image_url: imageUrl,
        location: location.trim() || null,
        date_time: dateTime,
        max_attendees: maxAttendees
          ? parseInt(maxAttendees)
          : 10,
        ride_sharing: rideSharing,
      })
      .eq('id', id)
      .select()
      .maybeSingle();

    setSaving(false);

    if (error) {
      console.error('Activity update error:', error);

      Alert.alert(
        'Could not save activity',
        error.message,
      );

      return;
    }

    if (!updatedActivity) {
      Alert.alert(
        'Update blocked',
        'The activity was not updated. This is most likely a Supabase permission/RLS issue.',
      );

      return;
    }

    console.log(
      'Activity updated successfully:',
      updatedActivity,
    );

    Alert.alert(
      'Saved',
      'Activity updated successfully.',
      [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ],
    );
  }
  async function handleDeleteActivity() {
    Alert.alert(
      'Delete Activity',
      'Are you sure you want to delete this activity? This cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const {
                data: { user },
                error: authError,
              } = await supabase.auth.getUser();

              if (authError) {
                throw new Error(authError.message);
              }

              if (!user) {
                throw new Error(
                  'You must be logged in.',
                );
              }

              /*
               * Remove RSVPs first.
               */
              const { error: rsvpError } =
                await supabase
                  .from('rsvps')
                  .delete()
                  .eq('activity_id', id);

              if (rsvpError) {
                throw new Error(
                  rsvpError.message,
                );
              }

              /*
               * Remove private activity
               * join requests.
               */
              const { error: requestError } =
                await supabase
                  .from(
                    'activity_join_requests',
                  )
                  .delete()
                  .eq('activity_id', id);

              if (requestError) {
                throw new Error(
                  requestError.message,
                );
              }

              /*
               * Finally delete the activity.
               *
               * host_id check prevents another
               * user from deleting the activity.
               */
              const { error: deleteError } =
                await supabase
                  .from('activities')
                  .delete()
                  .eq('id', id)
                  .eq('host_id', user.id);

              if (deleteError) {
                throw new Error(
                  deleteError.message,
                );
              }

              Alert.alert(
                'Activity deleted',
                'The activity has been deleted.',
                [
                  {
                    text: 'OK',
                    onPress: () =>
                      router.replace('/(tabs)'),
                  },
                ],
              );
            } catch (error) {
              Alert.alert(
                'Could not delete activity',
                error instanceof Error
                  ? error.message
                  : 'Something went wrong.',
              );
            }
          },
        },
      ],
    );
  }

  if (loading) {
    return (
      <AppView style={[styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator color={colors.tint} />
      </AppView>
    );
  }

  const heroUri = newAsset?.uri ?? existingImageUrl ?? CATEGORY_IMAGES[category.toLowerCase()] ?? 'https://picsum.photos/seed/activity/900/500';

  return (
    <AppView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView
          style={{ backgroundColor: colors.background }}
          contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {/* Hero image — tappable to change */}
          <TouchableOpacity activeOpacity={0.85} onPress={pickImage} style={styles.hero}>
            <Image source={{ uri: heroUri }} style={StyleSheet.absoluteFillObject} contentFit="cover" cachePolicy="none" />
            {/* dim overlay */}
            <View style={styles.heroDim} />
            {/* top bar: back + title */}
            <View style={[styles.heroTop, { paddingTop: insets.top + 8 }]}>
              <TouchableOpacity onPress={() => router.back()} style={[styles.backButton, { backgroundColor: colors.background }]}>
                <IconSymbol name="chevron.left" size={20} color={colors.text} />
              </TouchableOpacity>
              <AppText style={[styles.heroTitle, { color: '#fff', fontFamily: Fonts?.sans }]}>Edit Activity</AppText>
              <View style={styles.backButton} />
            </View>
            {/* camera badge */}
            <View style={styles.cameraBadge}>
              <IconSymbol name="camera.fill" size={16} color="#fff" />
              <AppText style={[styles.cameraBadgeText, { fontFamily: Fonts?.sans }]}>
                {newAsset ? 'Change photo' : 'Tap to change photo'}
              </AppText>
            </View>
          </TouchableOpacity>

          <View style={styles.form}>
            {/* Activity details */}
            <View style={styles.section}>
              <AppText style={[styles.sectionHeading, { color: colors.text, fontFamily: Fonts?.sans }]}>Activity Details</AppText>
              <PostField label="Activity Title" value={title} onChangeText={setTitle} placeholder="Board game night, pickleball..." />

              <View style={styles.categorySection}>
                <AppText style={[styles.fieldLabel, { color: colors.text, fontFamily: Fonts?.sans }]}>Category</AppText>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryList} keyboardShouldPersistTaps="handled">
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
                      <AppText style={[styles.categoryText, { color: category === cat ? colors.onImageOverlay : colors.text, fontFamily: Fonts?.sans }]}>
                        {cat}
                      </AppText>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <PostField label="Description" value={description} onChangeText={setDescription} placeholder="Add details people should know..." multiline />
              <PostField label="Location" value={location} onChangeText={setLocation} placeholder="Lambright, Starbucks, Walmart..." />
            </View>

            {/* Time / capacity */}
            <View style={styles.section}>
              <AppText style={[styles.sectionHeading, { color: colors.text, fontFamily: Fonts?.sans }]}>Time and Capacity</AppText>
              <View style={styles.row}>
                <View style={styles.rowItem}>
                  <PostField label="Date" value={date} onChangeText={setDate} placeholder="Fri, Jul 12" />
                </View>
                <View style={styles.rowItem}>
                  <PostField label="Time" value={time} onChangeText={setTime} placeholder="7:00 PM" />
                </View>
              </View>
              <PostField label="Max Attendees" value={maxAttendees} onChangeText={setMaxAttendees} placeholder="10" keyboardType="numeric" />
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
                  <AppText
                    style={[
                      styles.rideTitle,
                      {
                        color: colors.text,
                        fontFamily: Fonts?.sans,
                      },
                    ]}
                  >
                    Ride sharing
                  </AppText>

                  <AppText
                    style={[
                      styles.rideSubtitle,
                      {
                        color: colors.outline,
                        fontFamily: Fonts?.sans,
                      },
                    ]}
                  >
                    Allow attendees to find or offer rides for this activity.
                  </AppText>
                </View>

                <TouchableOpacity
                  onPress={() =>
                    setRideSharing((value) => !value)
                  }
                  style={[
                    styles.toggleButton,
                    rideSharing
                      ? { backgroundColor: colors.tint }
                      : {
                        backgroundColor:
                          colors.surfaceContainerHigh,
                      },
                  ]}
                >
                  <AppText
                    style={[
                      styles.toggleText,
                      {
                        color: rideSharing
                          ? colors.onImageOverlay
                          : colors.text,
                        fontFamily: Fonts?.sans,
                      },
                    ]}
                  >
                    {rideSharing ? 'Yes' : 'No'}
                  </AppText>
                </TouchableOpacity>
              </View>
            </View>

            {/* Save */}
            <TouchableOpacity
              onPress={handleSave}
              disabled={saving}
              style={[
                styles.submitButton,
                {
                  backgroundColor:
                    saving
                      ? colors.outline
                      : colors.tint,
                },
              ]}
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
                {saving ? 'Saving...' : 'Save Changes'}
              </AppText>
            </TouchableOpacity>

            {/* Delete Activity */}
            <TouchableOpacity
              onPress={handleDeleteActivity}
              disabled={saving}
              style={styles.deleteButton}
            >
              <IconSymbol
                name="trash"
                size={18}
                color="#D32F2F"
              />

              <AppText
                style={[
                  styles.deleteText,
                  {
                    fontFamily: Fonts?.sans,
                  },
                ]}
              >
                Delete Activity
              </AppText>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </AppView>
  );
}
const HERO_HEIGHT = 260;

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { flex: 1 },
  keyboardView: { flex: 1 },
  hero: {
    height: HERO_HEIGHT,
    overflow: 'hidden',
    justifyContent: 'space-between',
  },
  heroDim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.40)',
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.92,
  },
  cameraBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'center',
    marginBottom: 18,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  cameraBadgeText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  form: {
    paddingHorizontal: 16,
    paddingTop: 20,
    gap: 20,
  },
  deleteButton: {
    minHeight: 50,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#D32F2F',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },

  deleteText: {
    color: '#D32F2F',
    fontSize: 15,
    fontWeight: '700',
  },
  section: { gap: 14 },
  sectionHeading: { fontSize: 18, fontWeight: '700' },
  fieldLabel: { fontSize: 14, fontWeight: '600' },
  categorySection: { gap: 8 },
  categoryList: { gap: 8, paddingRight: 16 },
  categoryPill: { borderRadius: 20, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 8 },
  categoryText: { fontSize: 14, fontWeight: '500' },
  row: { flexDirection: 'row', gap: 12 },
  rowItem: { flex: 1 },
  rideCard: { borderWidth: 1, borderRadius: 18, padding: 16, gap: 14 },
  rideHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  rideTextContainer: { flex: 1 },
  rideTitle: { fontSize: 16, fontWeight: '700' },
  rideSubtitle: { fontSize: 13, marginTop: 2 },
  toggleButton: { borderRadius: 18, paddingHorizontal: 16, paddingVertical: 8 },
  toggleText: { fontSize: 14, fontWeight: '700' },
  submitButton: { borderRadius: 24, paddingVertical: 14, alignItems: 'center' },
  submitText: { fontSize: 16, fontWeight: '700' },
});
