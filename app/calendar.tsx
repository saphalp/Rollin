import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Switch, TouchableOpacity, View } from 'react-native';
import { Calendar } from 'react-native-calendars';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CalendarExportButton } from '@/components/calendar/export-events';
import { AppText } from '@/components/text';
import { TourTarget, TourScrollView } from '@/components/tutorial/tour-target';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useCalendarPlans } from '@/hooks/use-calendar-plans';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { calendarDay, calendarPlanRoute, filterCalendarPlans, groupCalendarPlans, type ActivityFilter, type CalendarPlan } from '@/lib/calendar-plans';
import { BACK_BUTTON_SIZE, BackButton } from '@/components/ui/back-button';
import { Ionicons } from '@expo/vector-icons';

const OWN_COLOR = '#b97000';
const OTHER_COLOR = '#0058be';
const RIDE_COLOR = '#087f6d';
const PAGE_SIZE = 20;
const FILTERS: { value: ActivityFilter; label: string }[] = [
  { value: 'mine', label: 'My activities' }, { value: 'created', label: 'Created' },
  { value: 'joined', label: 'Joined' }, { value: 'all', label: 'All activities' },
];
const dayLabel = (day: string) => new Date(day + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
const planColor = (plan: CalendarPlan) => plan.kind === 'ride' ? RIDE_COLOR : plan.created ? OWN_COLOR : OTHER_COLOR;

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_RANGE = Array.from({ length: 11 }, (_, i) => CURRENT_YEAR - 5 + i);
const TODAY = new Date().toISOString().slice(0, 10);

export default function CalendarScreen() {
  const colors = Colors[useColorScheme() ?? 'light'];
  const insets = useSafeAreaInsets();
  const { plans, loading, loaded, error, now, refresh, userId } = useCalendarPlans();
  const [filter, setFilter] = useState<ActivityFilter>('mine');
  const [includeRides, setIncludeRides] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [displayDate, setDisplayDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [calendarKey, setCalendarKey] = useState(0);
  const [yearPickerVisible, setYearPickerVisible] = useState(false);

  const visible = filterCalendarPlans(plans, filter, includeRides);
  const upcoming = visible.filter(plan => plan.startsAt >= now);
  const selected = selectedDate ? visible.filter(plan => calendarDay(plan.startsAt) === selectedDate) : [];
  const groups = groupCalendarPlans(upcoming.slice(0, visibleCount));

  const markedDates: Record<string, { dots: { key: string; color: string }[]; selected?: boolean; selectedColor?: string }> = {};
  for (const plan of visible) {
    const day = calendarDay(plan.startsAt);
    const mark = markedDates[day] ??= { dots: [] };
    const color = planColor(plan);
    if (!mark.dots.some(dot => dot.color === color)) mark.dots.push({ key: color, color });
  }
  if (selectedDate) markedDates[selectedDate] = { dots: markedDates[selectedDate]?.dots ?? [], selected: true, selectedColor: colors.tint };

  function handleYearSelect(year: number) {
    const mm = displayDate.slice(5, 7);
    setDisplayDate(`${year}-${mm}-01`);
    setCalendarKey(k => k + 1);
    setYearPickerVisible(false);
  }

  function planRow(plan: CalendarPlan) {
    return (
      <TouchableOpacity key={plan.key} accessibilityRole="button" style={[styles.plan, { backgroundColor: colors.cardBackground, borderColor: colors.outlineVariant }]}
        onPress={() => router.push(calendarPlanRoute(plan))}>
        <View style={[styles.icon, { backgroundColor: plan.kind === 'ride' ? '#e2f4ef' : '#eaf2ff' }]}>
          <IconSymbol name={plan.kind === 'ride' ? 'car.fill' : 'calendar'} size={22} color={planColor(plan)} />
        </View>
        <View style={styles.planBody}>
          <AppText style={[styles.kind, { color: planColor(plan) }]}>{plan.kind === 'ride' ? 'Ride' : 'Activity'} · {plan.label}</AppText>
          <AppText style={styles.planTitle}>{plan.title}</AppText>
          <AppText style={[styles.meta, { color: colors.icon }]}>{new Date(plan.startsAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</AppText>
          {!!plan.location && <AppText style={[styles.meta, { color: colors.icon }]}>{plan.location}</AppText>}
        </View>
        <IconSymbol name="chevron.right" size={18} color={colors.tint} />
      </TouchableOpacity>
    );
  }

  const displayYear = parseInt(displayDate.slice(0, 4), 10);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: colors.outlineVariant }]}>
        <BackButton />
        <TourTarget id="calendar-heading"><AppText style={styles.headerTitle}>Calendar</AppText></TourTarget>
        <View style={styles.backBtn} />
      </View>

      <TourScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading && loaded} onRefresh={refresh} tintColor={colors.tint} colors={[colors.tint]} />}>
        <TourTarget id="calendar-grid-and-legend">
          <Calendar
            key={calendarKey}
            current={displayDate}
            markingType="multi-dot"
            markedDates={markedDates}
            onDayPress={day => setSelectedDate(day.dateString === selectedDate ? null : day.dateString)}
            onMonthChange={month => setDisplayDate(month.dateString)}
            dayComponent={({ date, state, marking, onPress }: any) => {
              if (!date) return null;
              const isToday = date.dateString === TODAY;
              const isSelected = date.dateString === selectedDate;
              const isDisabled = state === 'disabled';
              const dots: { key: string; color: string }[] = marking?.dots ?? [];

              const bgColor = isSelected ? colors.tint : 'transparent';
              const textColor = isSelected
                ? '#fff'
                : isToday
                ? colors.tint
                : isDisabled
                ? colors.outlineVariant
                : colors.text;

              return (
                <TouchableOpacity onPress={() => onPress(date)} style={styles.dayCell} activeOpacity={0.7}>
                  <View style={[styles.dayCircle, { backgroundColor: bgColor }]}>
                    <AppText style={[styles.dayNum, { color: textColor, fontWeight: isToday || isSelected ? '700' : '400' }]}>
                      {date.day}
                    </AppText>
                  </View>
                  {dots.length > 0 && (
                    <View style={styles.dayDots}>
                      {dots.slice(0, 3).map((dot) => (
                        <View key={dot.key} style={[styles.dayDot, { backgroundColor: isSelected ? '#fff' : dot.color }]} />
                      ))}
                    </View>
                  )}
                </TouchableOpacity>
              );
            }}
            renderArrow={(direction) => (
              <View style={[styles.arrowBtn, { backgroundColor: colors.tint + '18' }]}>
                <Ionicons
                  name={direction === 'left' ? 'chevron-back' : 'chevron-forward'}
                  size={22}
                  color={colors.tint}
                />
              </View>
            )}
            renderHeader={(date: any) => {
              const d = new Date(typeof date === 'string' ? date : date.toString());
              const month = d.toLocaleString('en-US', { month: 'long' });
              const year = d.getFullYear();
              return (
                <Pressable
                  onPress={() => setYearPickerVisible(true)}
                  style={styles.calHeader}
                  accessibilityRole="button"
                  accessibilityLabel={`${month} ${year}, tap to change year`}
                >
                  <AppText style={[styles.calHeaderText, { color: colors.text }]}>
                    {month}{' '}
                  </AppText>
                  <AppText style={[styles.calHeaderText, styles.calHeaderYear, { color: colors.tint }]}>
                    {year}
                  </AppText>
                  <Ionicons name="chevron-down" size={14} color={colors.tint} style={{ marginLeft: 2, marginTop: 2 }} />
                </Pressable>
              );
            }}
            theme={{
              backgroundColor: colors.background, calendarBackground: colors.background,
              textSectionTitleColor: colors.icon, dayTextColor: colors.text,
              monthTextColor: colors.text, arrowColor: colors.tint,
            }}
          />
          <View style={styles.legend}>
            {[['Hosting', OWN_COLOR], ['Activities', OTHER_COLOR], ['Rides', RIDE_COLOR]].map(([label, color]) => (
              <View key={label} style={styles.legendItem}><View style={[styles.dot, { backgroundColor: color }]} /><AppText style={styles.meta}>{label}</AppText></View>
            ))}
          </View>
        </TourTarget>

        <View style={styles.section}>
          <AppText style={styles.sectionTitle}>Show activities</AppText>
          <View style={styles.filters}>
            {FILTERS.map(option => <TouchableOpacity key={option.value} accessibilityRole="radio" accessibilityState={{ checked: filter === option.value }}
              onPress={() => { setFilter(option.value); setVisibleCount(PAGE_SIZE); }}
              style={[styles.chip, { borderColor: colors.tint, backgroundColor: filter === option.value ? colors.tint : colors.cardBackground }]}>
              <AppText style={[styles.chipLabel, { color: filter === option.value ? '#fff' : colors.tint }]}>{option.label}</AppText>
            </TouchableOpacity>)}
          </View>
          <View style={styles.rideToggle}>
            <View style={styles.planBody}><AppText style={styles.sectionTitle}>Include my rides</AppText><AppText style={[styles.meta, { color: colors.icon }]}>Your offers and accepted seats</AppText></View>
            <Switch accessibilityLabel="Include my rides" value={includeRides} onValueChange={value => { setIncludeRides(value); setVisibleCount(PAGE_SIZE); }} trackColor={{ true: colors.tint }} />
          </View>
        </View>

        <CalendarExportButton selectedDate={selectedDate} />

        <View style={styles.section}>
          {!!error && <View style={[styles.notice, { borderColor: colors.error }]}>
            <AppText accessibilityRole="alert" style={{ color: colors.error }}>{error}</AppText>
            {loaded && <AppText style={styles.meta}>Showing your last loaded plans.</AppText>}
            <TouchableOpacity accessibilityRole="button" onPress={refresh} style={styles.action}><AppText style={{ color: colors.tint, fontWeight: '700' }}>Retry</AppText></TouchableOpacity>
          </View>}
          {!userId ? <AppText>Sign in to view your plans.</AppText> : !loaded && loading ? <View style={styles.loading}><ActivityIndicator color={colors.tint} /><AppText>Loading your plans…</AppText></View> : loaded && <>
            {selectedDate && <View style={styles.group}>
              <View style={styles.sectionHeader}><AppText style={[styles.sectionTitle, styles.planBody]}>{dayLabel(selectedDate)}</AppText>
                <TouchableOpacity accessibilityRole="button" accessibilityLabel="Clear selected date" onPress={() => setSelectedDate(null)} style={styles.action}><AppText style={{ color: colors.tint }}>Clear</AppText></TouchableOpacity>
              </View>
              {selected.length ? selected.map(planRow) : <AppText style={{ color: colors.icon }}>No plans on this day with these filters.</AppText>}
            </View>}
            <AppText accessibilityRole="header" style={styles.agendaTitle}>Upcoming agenda</AppText>
            {!upcoming.length && <AppText style={{ color: colors.icon }}>No upcoming plans with these filters.</AppText>}
            {groups.map(group => <View key={group.day} style={styles.group}><AppText style={styles.sectionTitle}>{dayLabel(group.day)}</AppText>{group.plans.map(planRow)}</View>)}
            {upcoming.length > visibleCount && <TouchableOpacity accessibilityRole="button" onPress={() => setVisibleCount(count => count + PAGE_SIZE)} style={[styles.more, { borderColor: colors.tint }]}>
              <AppText style={{ color: colors.tint, fontWeight: '700' }}>Show more plans</AppText>
            </TouchableOpacity>}
          </>}
        </View>
      </TourScrollView>

      {/* Year picker modal */}
      <Modal
        visible={yearPickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setYearPickerVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setYearPickerVisible(false)}>
          <Pressable style={[styles.yearSheet, { backgroundColor: colors.cardBackground }]} onPress={() => {}}>
            <View style={[styles.yearSheetHandle, { backgroundColor: colors.outlineVariant }]} />
            <AppText style={[styles.yearSheetTitle, { color: colors.text }]}>Select year</AppText>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.yearList}>
              {YEAR_RANGE.map(year => (
                <Pressable
                  key={year}
                  onPress={() => handleYearSelect(year)}
                  style={[
                    styles.yearRow,
                    year === displayYear && { backgroundColor: colors.tint + '18' },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`${year}${year === displayYear ? ', selected' : ''}`}
                >
                  <AppText style={[
                    styles.yearRowText,
                    { color: year === displayYear ? colors.tint : colors.text },
                    year === displayYear && { fontWeight: '700' },
                  ]}>
                    {year}
                  </AppText>
                  {year === displayYear && (
                    <Ionicons name="checkmark" size={18} color={colors.tint} />
                  )}
                </Pressable>
              ))}
            </ScrollView>
            <Pressable
              onPress={() => setYearPickerVisible(false)}
              style={[styles.yearSheetCancel, { borderTopColor: colors.outlineVariant }]}
              accessibilityRole="button"
            >
              <AppText style={{ color: colors.tint, fontWeight: '700', fontSize: 16 }}>Cancel</AppText>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  backBtn: { width: BACK_BUTTON_SIZE, height: BACK_BUTTON_SIZE },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, paddingHorizontal: 20, paddingVertical: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  section: { paddingHorizontal: 20, paddingVertical: 8, gap: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '700' },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 44, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1, justifyContent: 'center' },
  chipLabel: { fontSize: 14, fontWeight: '700', textAlign: 'center' },
  rideToggle: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  agendaTitle: { fontSize: 20, fontWeight: '700', marginTop: 4 },
  group: { gap: 10, marginBottom: 8 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  plan: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, borderWidth: 1 },
  icon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  planBody: { flex: 1 },
  kind: { fontSize: 13, lineHeight: 20, fontWeight: '700' },
  planTitle: { fontSize: 16, fontWeight: '700' },
  meta: { fontSize: 13, lineHeight: 20 },
  notice: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 8 },
  action: { minHeight: 44, paddingHorizontal: 8, justifyContent: 'center', alignItems: 'center' },
  loading: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  more: { minHeight: 48, padding: 12, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  // Calendar header
  calHeader: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  calHeaderText: { fontSize: 17, fontWeight: '600' },
  calHeaderYear: { fontWeight: '700' },
  arrowBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  // Year picker
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  yearSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 12, maxHeight: 420 },
  yearSheetHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 12 },
  yearSheetTitle: { fontSize: 16, fontWeight: '700', textAlign: 'center', paddingBottom: 8 },
  yearList: { paddingHorizontal: 20, paddingBottom: 8 },
  yearRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 12, borderRadius: 10 },
  yearRowText: { fontSize: 17 },
  yearSheetCancel: { borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 16, alignItems: 'center' },
  // Day cell
  dayCell: { alignItems: 'center', paddingVertical: 4, width: '100%' },
  dayCircle: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  dayNum: { fontSize: 14, lineHeight: 18 },
  dayDots: { flexDirection: 'row', gap: 2.5, marginTop: 2 },
  dayDot: { width: 5, height: 5, borderRadius: 2.5 },
});
