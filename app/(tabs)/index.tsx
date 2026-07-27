import { useCallback, useEffect, useState } from 'react';
import { Image } from 'expo-image';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';

import { ActivityCard } from '@/components/activity-card';
import { AppText } from '@/components/text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { AppView } from '@/components/view';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { supabase } from '@/lib/supabase';

const CATEGORIES = ['All', 'Social', 'Sports', 'Music', 'Study', 'Outdoor', 'Gaming'];

const CATEGORY_IMAGES: Record<string, string> = {
  social: 'https://picsum.photos/seed/social/900/500',
  sports: 'https://picsum.photos/seed/sports/900/500',
  music: 'https://picsum.photos/seed/music/900/500',
  study: 'https://picsum.photos/seed/study/900/500',
  outdoor: 'https://picsum.photos/seed/outdoor/900/500',
  gaming: 'https://picsum.photos/seed/gaming/900/500',
  grocery: 'https://picsum.photos/seed/grocery/900/500',
};

type Activity = {
  id: string;
  title: string;
  category: 'social' | 'sports' | 'music' | 'study' | 'outdoor' | 'gaming' | 'grocery';
  date?: string;
  host?: string;
  imageUrl?: string;
  attendeeCount: number;
  maxAttendees: number;
  ridesAvailable?: number;
};

function formatDate(dateStr: string | null): string | undefined {
  if (!dateStr) return undefined;
  return new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function HomeScreen() {
  const theme = useColorScheme() ?? 'light';
  const colors = Colors[theme];
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchActivities();
  }, [selectedCategory]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchActivities().finally(() => setRefreshing(false));
  }, [selectedCategory]);

  async function fetchActivities() {
    setLoading(true);
    let query = supabase
      .from('activities')
      .select('id, title, category, date_time, max_attendees, rides_available, image_url, rsvps(id)')
      .order('date_time', { ascending: true });

    if (selectedCategory !== 'All') {
      query = query.eq('category', selectedCategory.toLowerCase());
    }

    const { data, error } = await query;

    if (error) {
      console.error('fetchActivities error:', error);
      setLoading(false);
      return;
    }

    if (data) {
      setActivities(
        data.map((a: any) => ({
          id: a.id,
          title: a.title,
          category: a.category ?? 'social',
          date: formatDate(a.date_time),
          imageUrl: a.image_url ?? CATEGORY_IMAGES[a.category as string] ?? undefined,
          attendeeCount: a.rsvps?.length ?? 0,
          maxAttendees: a.max_attendees ?? 10,
          ridesAvailable: a.rides_available ?? 0,
        }))
      );
    }
    setLoading(false);
  }

  const filtered = searchQuery.trim()
    ? activities.filter((a) => a.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : activities;

  const featured = filtered[0];
  const recommended = filtered.slice(1);

  return (
    <AppView style={styles.container}>
      <ScrollView
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Greeting */}
        <View style={styles.greeting}>
          <AppText style={[styles.greetingName, { color: colors.text, fontFamily: Fonts?.sans }]}>
            Hey there!
          </AppText>
          <AppText style={[styles.greetingQuestion, { color: colors.text, fontFamily: Fonts?.sans }]}>
            What are you doing today?
          </AppText>
        </View>

        {/* Search row */}
        <View style={styles.searchRow}>
          <View style={[styles.searchBar, { backgroundColor: colors.surfaceContainerHigh, borderColor: colors.outlineVariant }]}>
            <IconSymbol name="magnifyingglass" size={18} color={colors.outline} />
            <TextInput
              placeholder="Find activities or ride"
              placeholderTextColor={colors.outline}
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={[styles.searchInput, { color: colors.text, fontFamily: Fonts?.sans }]}
            />
          </View>
          <TouchableOpacity style={[styles.filterButton, { borderColor: colors.outlineVariant, backgroundColor: colors.cardBackground }]}>
            <IconSymbol name="line.3.horizontal.decrease" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Category pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pills}>
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat}
              onPress={() => setSelectedCategory(cat)}
              style={[
                styles.pill,
                selectedCategory === cat
                  ? { backgroundColor: colors.tint, borderColor: colors.tint }
                  : { backgroundColor: 'transparent', borderColor: colors.outline },
              ]}
            >
              <AppText style={[
                styles.pillText,
                { color: selectedCategory === cat ? colors.onImageOverlay : colors.text, fontFamily: Fonts?.sans },
              ]}>
                {cat}
              </AppText>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {loading ? (
          <ActivityIndicator color={colors.tint} style={styles.loader} />
        ) : filtered.length === 0 ? (
          <View style={styles.empty}>
            <AppText style={[styles.emptyText, { color: colors.outline, fontFamily: Fonts?.sans }]}>
              No activities found
            </AppText>
          </View>
        ) : (
          <>
            {/* Featured */}
            {featured && (
              <>
                <AppText style={[styles.sectionHeading, { color: colors.text, fontFamily: Fonts?.sans }]}>
                  Featured
                </AppText>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => router.push(`/activity/${featured.id}`)}
                  style={[styles.featuredCard, { backgroundColor: colors.primaryContainer }]}
                >
                  {featured.imageUrl ? (
                    <Image
                      source={{ uri: featured.imageUrl }}
                      style={StyleSheet.absoluteFillObject}
                      contentFit="cover"
                      cachePolicy="memory-disk"
                    />
                  ) : null}
                  <View style={styles.featuredDim} />
                  {featured.ridesAvailable !== undefined && featured.ridesAvailable > 0 && (
                    <View style={[styles.rideBadge, { backgroundColor: colors.secondaryContainer }]}>
                      <IconSymbol name="car.fill" size={12} color={colors.onSecondaryContainer} />
                      <AppText style={[styles.rideBadgeText, { color: colors.onSecondaryContainer, fontFamily: Fonts?.sans }]}>
                        Ride sharing available
                      </AppText>
                    </View>
                  )}
                  <View style={styles.featuredOverlay}>
                    {featured.host && (
                      <View style={styles.hostRow}>
                        <View style={[styles.hostAvatar, { backgroundColor: colors.tint }]} />
                        <AppText style={[styles.hostedBy, { fontFamily: Fonts?.sans, color: colors.onImageOverlay }]}>
                          Hosted by {featured.host}
                        </AppText>
                      </View>
                    )}
                    <AppText style={[styles.featuredTitle, { fontFamily: Fonts?.sans, color: colors.onImageOverlay }]}>
                      {featured.title}
                    </AppText>
                    <View style={styles.joinedRow}>
                      <IconSymbol name="person.2.fill" size={14} color={colors.onImageOverlay} />
                      <AppText style={[styles.joinedText, { fontFamily: Fonts?.sans, color: colors.onImageOverlay }]}>
                        {featured.attendeeCount}/{featured.maxAttendees} joined
                      </AppText>
                    </View>
                  </View>
                </TouchableOpacity>
              </>
            )}

            {/* Recommended */}
            {recommended.length > 0 && (
              <>
                <AppText style={[styles.sectionHeading, { color: colors.text, fontFamily: Fonts?.sans }]}>
                  Recommended for you
                </AppText>
                <View style={styles.cardList}>
                  {recommended.map((activity) => (
                    <ActivityCard
                      key={activity.id}
                      title={activity.title}
                      category={activity.category}
                      date={activity.date}
                      imageUrl={activity.imageUrl}
                      attendeeCount={activity.attendeeCount}
                      maxAttendees={activity.maxAttendees}
                      ridesAvailable={activity.ridesAvailable}
                      onPress={() => router.push(`/activity/${activity.id}`)}
                    />
                  ))}
                </View>
              </>
            )}
          </>
        )}
      </ScrollView>
    </AppView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 16,
  },
  greeting: { gap: 2 },
  greetingName: { fontSize: 16 },
  greetingQuestion: { fontSize: 20, fontWeight: '700' },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 15, padding: 0 },
  filterButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pills: { gap: 8, paddingRight: 16 },
  pill: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  pillText: { fontSize: 14, fontWeight: '500' },
  sectionHeading: { fontSize: 18, fontWeight: '700' },
  featuredCard: {
    borderRadius: 12,
    height: 180,
    overflow: 'hidden',
    justifyContent: 'space-between',
    padding: 12,
  },
  featuredDim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  rideBadge: {
    flexDirection: 'row',
    alignSelf: 'flex-end',
    alignItems: 'center',
    gap: 4,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  rideBadgeText: { fontSize: 12, fontWeight: '600' },
  featuredOverlay: { gap: 4 },
  hostRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  hostAvatar: { width: 20, height: 20, borderRadius: 10 },
  hostedBy: { fontSize: 12 },
  featuredTitle: { fontSize: 22, fontWeight: '700' },
  joinedRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  joinedText: { fontSize: 13 },
  cardList: { gap: 12 },
  loader: { marginTop: 40 },
  empty: { alignItems: 'center', marginTop: 40 },
  emptyText: { fontSize: 15 },
});
