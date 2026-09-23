import { Image } from 'expo-image';
import { router, Stack } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';

import { AppText } from '@/components/text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { supabase } from '@/lib/supabase';

type SavedActivity = {
  id: string;
  title: string;
  category: string;
  date?: string;
  imageUrl?: string;
  attendeeCount: number;
  maxAttendees: number;
};

function formatDate(dateStr: string | null): string | undefined {
  if (!dateStr) return undefined;
  return new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  });
}

const CATEGORY_IMAGES: Record<string, string> = {
  social: 'https://picsum.photos/seed/social/900/500',
  sports: 'https://picsum.photos/seed/sports/900/500',
  music: 'https://picsum.photos/seed/music/900/500',
  study: 'https://picsum.photos/seed/study/900/500',
  outdoor: 'https://picsum.photos/seed/outdoor/900/500',
  gaming: 'https://picsum.photos/seed/gaming/900/500',
};

const CATEGORY_COLORS: Record<string, string> = {
  social: '#6366F1',
  sports: '#10B981',
  music: '#F59E0B',
  study: '#3B82F6',
  outdoor: '#22C55E',
  gaming: '#8B5CF6',
  grocery: '#EF4444',
};

type SwipeableRowProps = {
  item: SavedActivity;
  onRemove: (id: string) => void;
  colors: typeof Colors.light;
};

function SwipeableRow({ item, onRemove, colors }: SwipeableRowProps) {
  const swipeableRef = useRef<Swipeable>(null);

  const renderRightActions = (
    _progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>,
  ) => {
    const scale = dragX.interpolate({
      inputRange: [-80, 0],
      outputRange: [1, 0.8],
      extrapolate: 'clamp',
    });

    return (
      <TouchableOpacity
        style={styles.deleteAction}
        onPress={() => {
          swipeableRef.current?.close();
          onRemove(item.id);
        }}
        activeOpacity={0.85}
      >
        <Animated.View style={{ transform: [{ scale }], alignItems: 'center', gap: 4 }}>
          <IconSymbol name="bookmark.fill" size={20} color="#fff" />
          <AppText style={styles.deleteText}>Remove</AppText>
        </Animated.View>
      </TouchableOpacity>
    );
  };

  const categoryColor = CATEGORY_COLORS[item.category] ?? colors.tint;

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      rightThreshold={40}
      overshootRight={false}
    >
      <TouchableOpacity
        style={[styles.card, { backgroundColor: colors.cardBackground }]}
        onPress={() => router.push(`/activity/${item.id}`)}
        activeOpacity={0.85}
      >
        <Image
          source={{ uri: item.imageUrl }}
          style={styles.thumbnail}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
        <View style={styles.cardBody}>
          <View style={[styles.categoryBadge, { backgroundColor: categoryColor + '20' }]}>
            <AppText style={[styles.categoryText, { color: categoryColor, fontFamily: Fonts?.sans }]}>
              {item.category.charAt(0).toUpperCase() + item.category.slice(1)}
            </AppText>
          </View>
          <AppText style={[styles.title, { color: colors.text, fontFamily: Fonts?.sans }]} numberOfLines={2}>
            {item.title}
          </AppText>
          <View style={styles.metaRow}>
            {item.date ? (
              <View style={styles.metaItem}>
                <IconSymbol name="calendar" size={11} color={colors.outline} />
                <AppText style={[styles.metaText, { color: colors.outline, fontFamily: Fonts?.sans }]}>
                  {item.date}
                </AppText>
              </View>
            ) : null}
            <View style={styles.metaItem}>
              <IconSymbol name="person.2.fill" size={11} color={colors.outline} />
              <AppText style={[styles.metaText, { color: colors.outline, fontFamily: Fonts?.sans }]}>
                {item.attendeeCount}/{item.maxAttendees}
              </AppText>
            </View>
          </View>
        </View>
        <IconSymbol name="chevron.right" size={16} color={colors.outlineVariant} />
      </TouchableOpacity>
    </Swipeable>
  );
}

export default function SavedActivitiesScreen() {
  const theme = useColorScheme() ?? 'light';
  const colors = Colors[theme];
  const [activities, setActivities] = useState<SavedActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchSaved(); }, []);

  async function fetchSaved() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data, error } = await supabase
      .from('saved_activities')
      .select('activity_id, activities(id, title, category, date_time, max_attendees, image_url, rsvps(id))')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) { console.error('fetchSaved error:', error); setLoading(false); return; }

    setActivities(
      (data ?? []).map((row: any) => {
        const a = row.activities;
        if (!a) return null;
        return {
          id: a.id,
          title: a.title,
          category: a.category ?? 'social',
          date: formatDate(a.date_time),
          imageUrl: a.image_url ?? CATEGORY_IMAGES[a.category] ?? undefined,
          attendeeCount: a.rsvps?.length ?? 0,
          maxAttendees: a.max_attendees ?? 10,
        };
      }).filter(Boolean) as SavedActivity[]
    );
    setLoading(false);
  }

  const handleRemove = useCallback(async (activityId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Optimistic remove
    setActivities((prev) => prev.filter((a) => a.id !== activityId));

    const { error } = await supabase
      .from('saved_activities')
      .delete()
      .eq('user_id', user.id)
      .eq('activity_id', activityId);

    if (error) {
      console.error('remove error:', error);
      fetchSaved(); // revert on failure
    }
  }, []);

  return (
    <>
      <Stack.Screen options={{ title: 'Saved Activities', headerBackTitle: 'Back', headerShown: true }} />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {loading ? (
          <View style={styles.loader}>
            <ActivityIndicator color={colors.tint} />
          </View>
        ) : activities.length === 0 ? (
          <View style={styles.empty}>
            <View style={[styles.emptyIconWrap, { backgroundColor: colors.surfaceContainer }]}>
              <IconSymbol name="bookmark" size={36} color={colors.outline} />
            </View>
            <AppText style={[styles.emptyTitle, { color: colors.text, fontFamily: Fonts?.sans }]}>
              No saved activities
            </AppText>
            <AppText style={[styles.emptySubtitle, { color: colors.outline, fontFamily: Fonts?.sans }]}>
              Tap the bookmark icon on any activity to save it here.
            </AppText>
          </View>
        ) : (
          <FlatList
            data={activities}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              <AppText style={[styles.count, { color: colors.outline, fontFamily: Fonts?.sans }]}>
                {activities.length} saved {activities.length === 1 ? 'activity' : 'activities'} · swipe left to remove
              </AppText>
            }
            renderItem={({ item }) => (
              <SwipeableRow item={item} onRemove={handleRemove} colors={colors} />
            )}
            ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: colors.outlineVariant }]} />}
          />
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingVertical: 8 },
  count: {
    fontSize: 12,
    fontWeight: '500',
    paddingHorizontal: 16,
    paddingVertical: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
  },
  thumbnail: {
    width: 72,
    height: 72,
    borderRadius: 10,
    backgroundColor: '#ddd',
  },
  cardBody: {
    flex: 1,
    gap: 5,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '700',
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 16 + 72 + 14,
  },
  deleteAction: {
    backgroundColor: '#E53935',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
  },
  deleteText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    fontFamily: undefined,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 16,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
