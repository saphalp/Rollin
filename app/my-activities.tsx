import { router, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { ScrollView } from 'react-native';

import ActivitySegmentedControl, { type ActivityView } from '@/components/profile/ActivitySegmentedControl';
import MyActivities from '@/components/profile/MyActivities';
import { AppText } from '@/components/text';
import { Colors, Fonts } from '@/constants/theme';
import { useAuthContext } from '@/hooks/use-auth-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { supabase } from '@/lib/supabase';

const CATEGORY_FALLBACK_IMAGE: Record<string, string> = {
  social: 'https://picsum.photos/seed/social/240/240',
  sports: 'https://picsum.photos/seed/sports/240/240',
  music: 'https://picsum.photos/seed/music/240/240',
  study: 'https://picsum.photos/seed/study/240/240',
  outdoor: 'https://picsum.photos/seed/outdoor/240/240',
  gaming: 'https://picsum.photos/seed/gaming/240/240',
};

type ActivityRow = {
  id: string;
  title: string;
  date: string;
  time: string;
  imageUri: string;
  dateTime: string | null;
};

function formatDate(iso: string | null) {
  if (!iso) return 'Date TBD';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(iso: string | null) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function toRow(a: any): ActivityRow {
  return {
    id: a.id,
    title: a.title,
    date: formatDate(a.date_time),
    time: formatTime(a.date_time),
    imageUri: a.image_url || CATEGORY_FALLBACK_IMAGE[a.category ?? ''] || CATEGORY_FALLBACK_IMAGE.social,
    dateTime: a.date_time,
  };
}

function sortByDate(rows: ActivityRow[]) {
  return [...rows].sort((a, b) => {
    if (!a.dateTime) return 1;
    if (!b.dateTime) return -1;
    return new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime();
  });
}

export default function MyActivitiesScreen() {
  const theme = useColorScheme() ?? 'light';
  const colors = Colors[theme];
  const { claims } = useAuthContext();
  const userId = claims?.sub as string | undefined;

  const [view, setView] = useState<ActivityView>('created');
  const [created, setCreated] = useState<ActivityRow[]>([]);
  const [joined, setJoined] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    fetchActivities();
  }, [userId]);

  async function fetchActivities() {
    setLoading(true);
    setError(null);

    const [createdResult, joinedResult] = await Promise.all([
      supabase.from('activities').select('id, title, date_time, image_url, category').eq('host_id', userId).order('date_time', { ascending: false }),
      supabase.from('rsvps').select('activity:activities(id, title, date_time, image_url, category)').eq('user_id', userId),
    ]);

    if (createdResult.error || joinedResult.error) {
      setError('Unable to load activities. Please try again.');
    }

    setCreated(sortByDate((createdResult.data ?? []).map(toRow)));

    const joinedRows = (joinedResult.data ?? []).flatMap((row: any) => {
      if (!row.activity) return [];
      return Array.isArray(row.activity) ? row.activity : [row.activity];
    });
    setJoined(sortByDate(joinedRows.map(toRow)));
    setLoading(false);
  }

  const displayed = view === 'created' ? created : joined;

  return (
    <>
      <Stack.Screen options={{ title: 'My Activities', headerBackTitle: 'Back', headerShown: true }} />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.control}>
          <ActivitySegmentedControl value={view} onChange={setView} />
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.tint} />
          </View>
        ) : error ? (
          <View style={styles.center}>
            <AppText style={[styles.message, { color: colors.error, fontFamily: Fonts?.sans }]}>{error}</AppText>
          </View>
        ) : displayed.length === 0 ? (
          <View style={styles.center}>
            <AppText style={[styles.message, { color: colors.outline, fontFamily: Fonts?.sans }]}>
              {view === 'created' ? "You haven't created any activities yet." : "You haven't joined any activities yet."}
            </AppText>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
            {displayed.map((activity) => (
              <MyActivities
                key={activity.id}
                title={activity.title}
                date={activity.date}
                time={activity.time}
                image={{ uri: activity.imageUri }}
                onPress={() => router.push(`/activity/${activity.id}`)}
              />
            ))}
          </ScrollView>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  control: { padding: 16, paddingBottom: 8 },
  list: { padding: 16, gap: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  message: { fontSize: 15, textAlign: 'center', lineHeight: 22 },
});
