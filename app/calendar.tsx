import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { supabase } from '@/lib/supabase';

type CalActivity = {
  id: string;
  title: string;
  date_time: string;
  max_attendees: number;
  host_id: string;
  rsvpCount: number;
};

const OWN_COLOR = '#fea619';
const OTHER_COLOR = '#3B82F6';

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function localDateKey(iso: string) {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function CalendarScreen() {
  const theme = useColorScheme() ?? 'light';
  const colors = Colors[theme];
  const insets = useSafeAreaInsets();

  const [activities, setActivities] = useState<CalActivity[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetchActivities();
  }, []);

  async function fetchActivities() {
    setLoading(true);
    setError(false);

    const [{ data: { user } }, { data, error: fetchErr }] = await Promise.all([
      supabase.auth.getUser(),
      supabase
        .from('activities')
        .select('id, title, date_time, max_attendees, host_id, rsvps(id)')
        .order('date_time', { ascending: true }),
    ]);

    if (fetchErr) {
      setError(true);
      setLoading(false);
      return;
    }

    setCurrentUserId(user?.id ?? null);
    setActivities(
      (data ?? []).map((a: any) => ({
        id: a.id,
        title: a.title,
        date_time: a.date_time,
        max_attendees: a.max_attendees,
        host_id: a.host_id,
        rsvpCount: a.rsvps?.length ?? 0,
      }))
    );
    setLoading(false);
  }

  // Build markedDates for the calendar
  const markedDates = activities.reduce((acc, a) => {
    const key = localDateKey(a.date_time);
    const isOwn = a.host_id === currentUserId;
    const dot = { key: a.id, color: isOwn ? OWN_COLOR : OTHER_COLOR };
    const existing = acc[key];
    acc[key] = {
      dots: [...(existing?.dots ?? []), dot],
      selected: key === selectedDate,
      selectedColor: colors.tint,
    };
    return acc;
  }, {} as Record<string, any>);

  // If a date is selected, make sure it keeps dots + selected styling
  if (selectedDate && markedDates[selectedDate]) {
    markedDates[selectedDate] = { ...markedDates[selectedDate], selected: true, selectedColor: colors.tint };
  } else if (selectedDate) {
    markedDates[selectedDate] = { selected: true, selectedColor: colors.tint, dots: [] };
  }

  const dayActivities = selectedDate
    ? activities.filter(a => localDateKey(a.date_time) === selectedDate)
    : [];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: colors.background, borderBottomColor: colors.outlineVariant }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <IconSymbol name="chevron.left" size={20} color={colors.text} />
        </TouchableOpacity>
        <AppText style={[styles.headerTitle, { color: colors.text, fontFamily: Fonts?.sans }]}>Calendar</AppText>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }} showsVerticalScrollIndicator={false}>
        {/* Calendar */}
        <Calendar
          markingType="multi-dot"
          markedDates={markedDates}
          onDayPress={(day: { dateString: string }) => setSelectedDate(day.dateString)}
          theme={{
            backgroundColor: colors.background,
            calendarBackground: colors.background,
            textSectionTitleColor: colors.outline,
            dayTextColor: colors.text,
            todayTextColor: colors.tint,
            selectedDayBackgroundColor: colors.tint,
            selectedDayTextColor: '#fff',
            monthTextColor: colors.text,
            arrowColor: colors.tint,
            dotColor: OTHER_COLOR,
            selectedDotColor: '#fff',
          }}
        />

        {/* Legend */}
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: OWN_COLOR }]} />
            <AppText style={[styles.legendText, { color: colors.outline, fontFamily: Fonts?.sans }]}>Your events</AppText>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: OTHER_COLOR }]} />
            <AppText style={[styles.legendText, { color: colors.outline, fontFamily: Fonts?.sans }]}>Others' events</AppText>
          </View>
        </View>

        {/* Day events */}
        {selectedDate && (
          <View style={styles.daySection}>
            <AppText style={[styles.dayHeading, { color: colors.text, fontFamily: Fonts?.sans }]}>
              {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </AppText>

            {loading ? (
              <ActivityIndicator color={colors.tint} style={{ marginTop: 16 }} />
            ) : error ? (
              <AppText style={[styles.emptyText, { color: colors.outline, fontFamily: Fonts?.sans }]}>
                Could not load events. Pull to refresh.
              </AppText>
            ) : dayActivities.length === 0 ? (
              <AppText style={[styles.emptyText, { color: colors.outline, fontFamily: Fonts?.sans }]}>
                No events on this day.
              </AppText>
            ) : (
              dayActivities.map(a => {
                const isOwn = a.host_id === currentUserId;
                return (
                  <TouchableOpacity
                    key={a.id}
                    style={[styles.eventRow, { backgroundColor: colors.surfaceContainerHigh, borderColor: colors.outlineVariant }]}
                    activeOpacity={0.75}
                    onPress={() => router.push(`/activity/${a.id}`)}
                  >
                    <View style={[styles.eventDot, { backgroundColor: isOwn ? OWN_COLOR : OTHER_COLOR }]} />
                    <View style={styles.eventInfo}>
                      <AppText style={[styles.eventTitle, { color: colors.text, fontFamily: Fonts?.sans }]} numberOfLines={1}>
                        {a.title}
                      </AppText>
                      <AppText style={[styles.eventMeta, { color: colors.outline, fontFamily: Fonts?.sans }]}>
                        {formatTime(a.date_time)} · {a.rsvpCount}/{a.max_attendees} joined
                      </AppText>
                    </View>
                    <IconSymbol name="chevron.right" size={16} color={colors.outline} />
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        )}

        {/* Loading overlay while switching months (no date selected) */}
        {loading && !selectedDate && (
          <ActivityIndicator color={colors.tint} style={{ marginTop: 8 }} />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  legend: {
    flexDirection: 'row',
    gap: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 13 },
  daySection: { paddingHorizontal: 20, paddingTop: 8, gap: 10 },
  dayHeading: { fontSize: 16, fontWeight: '700' },
  emptyText: { fontSize: 14, marginTop: 8 },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
  },
  eventDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  eventInfo: { flex: 1, gap: 3 },
  eventTitle: { fontSize: 15, fontWeight: '600' },
  eventMeta: { fontSize: 13 },
});
