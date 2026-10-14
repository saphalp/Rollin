import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Calendar } from 'react-native-calendars';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/text';
import { useAuthContext } from '@/hooks/use-auth-context';
import { createCalendarFile, dateKey, exportBounds, selectExportEvents, type ExportPeriod, type ExportScope } from '@/lib/calendar-export';
import { loadCalendarExport } from '@/lib/calendar-export-data';
import { shareCalendar } from '@/lib/share-calendar';

const scopes: { value: ExportScope; label: string }[] = [
  { value: 'created', label: 'Events I created' },
  { value: 'joined', label: 'Events I joined' },
  { value: 'created-joined', label: 'Events I created or joined' },
  { value: 'all', label: 'All events' },
];
const periods: { value: ExportPeriod; label: string }[] = [
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'month', label: 'This month' },
  { value: 'all', label: 'All dates' },
  { value: 'custom', label: 'Date range' },
];

export function CalendarExportButton({ selectedDate }: { selectedDate: string | null }) {
  const [visible, setVisible] = useState(false);
  const { claims } = useAuthContext();
  const userId = typeof claims?.sub === 'string' ? claims.sub : null;
  return (
    <View style={styles.entry}>
      <Pressable accessibilityRole="button" onPress={() => setVisible(true)} style={styles.outlineButton}>
        <AppText style={styles.blueLabel}>Export events</AppText>
      </Pressable>
      {visible && <ExportDialog key={userId} userId={userId} selectedDate={selectedDate} onClose={() => setVisible(false)} />}
    </View>
  );
}

function ExportDialog({ userId, selectedDate, onClose }: { userId: string | null; selectedDate: string | null; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const [now] = useState(() => new Date());
  const [scope, setScope] = useState<ExportScope>('created-joined');
  const [period, setPeriod] = useState<ExportPeriod>('upcoming');
  const [start, setStart] = useState(selectedDate ?? dateKey(now));
  const [end, setEnd] = useState(() => {
    const first = selectedDate ? new Date(selectedDate + 'T12:00:00') : now;
    return dateKey(new Date(first.getFullYear(), first.getMonth() + 1, 0));
  });
  const [dateField, setDateField] = useState<'start' | 'end' | null>(null);
  const [data, setData] = useState<Awaited<ReturnType<typeof loadCalendarExport>> | null>(null);
  const [loadError, setLoadError] = useState(userId ? '' : 'Sign in before exporting events.');
  const [exportError, setExportError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const sharing = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    if (!userId) return;
    loadCalendarExport(userId, controller.signal).then(result => {
      if (!controller.signal.aborted) setData(result);
    }).catch(error => {
      if (!controller.signal.aborted) setLoadError(error instanceof Error ? error.message : 'Could not load events. Please retry.');
    });
    return () => controller.abort();
  }, [userId, attempt]);

  let rangeError = '';
  let events: NonNullable<typeof data>['events'] = [];
  try {
    const bounds = exportBounds(period, start, end, now);
    if (data && userId) events = selectExportEvents(data.events, data.joinedIds, userId, scope, bounds);
  } catch (error) {
    rangeError = error instanceof Error ? error.message : 'Choose a valid date range.';
  }
  const loading = !data && !loadError;
  const disabled = busy || loading || !!loadError || !!rangeError || !events.length;

  async function exportFile() {
    if (disabled || sharing.current) return;
    sharing.current = true;
    setBusy(true);
    setExportError('');
    try {
      await shareCalendar(createCalendarFile(events), `rollin-events-${Date.now()}.ics`);
      if (mounted.current) onClose();
    } catch (error) {
      if (mounted.current) setExportError(error instanceof Error ? error.message : 'Could not export events. Please try again.');
    } finally {
      sharing.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={() => { if (!sharing.current) onClose(); }}>
      <View style={[styles.backdrop, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.panel} accessibilityViewIsModal>
          <View style={styles.header}>
            <AppText style={styles.title} accessibilityRole="header">Export events</AppText>
            <Pressable accessibilityRole="button" disabled={busy} onPress={onClose} style={styles.close}>
              <AppText style={styles.blueLabel}>Close</AppText>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.content}>
            <AppText style={styles.section}>Which events?</AppText>
            <View style={styles.options}>
              {scopes.map(option => (
                <Pressable key={option.value} accessibilityRole="radio" accessibilityState={{ checked: scope === option.value, disabled: busy }}
                  disabled={busy} onPress={() => setScope(option.value)} style={[styles.option, scope === option.value && styles.selected]}>
                  <View style={[styles.radio, scope === option.value && styles.radioSelected]}>
                    {scope === option.value && <View style={styles.radioDot} />}
                  </View>
                  <AppText style={styles.optionLabel}>{option.label}</AppText>
                </Pressable>
              ))}
            </View>
            {scope === 'all' && <AppText style={styles.hint}>All events available to you on the Rollin calendar.</AppText>}
            <AppText style={styles.section}>When?</AppText>
            <View style={styles.chips}>
              {periods.map(option => (
                <Pressable key={option.value} accessibilityRole="radio" accessibilityState={{ checked: period === option.value, disabled: busy }}
                  disabled={busy} onPress={() => { setPeriod(option.value); setDateField(null); }} style={[styles.chip, period === option.value && styles.selected]}>
                  <AppText style={styles.blueLabel}>{option.label}</AppText>
                </Pressable>
              ))}
            </View>
            {period === 'custom' && <>
              <View style={styles.dates}>
                {(['start', 'end'] as const).map(field => (
                  <Pressable key={field} accessibilityRole="button" disabled={busy} onPress={() => setDateField(dateField === field ? null : field)}
                    style={[styles.date, dateField === field && styles.selected]}>
                    <AppText style={styles.hint}>{field === 'start' ? 'From' : 'Through'}</AppText>
                    <AppText style={styles.blueLabel}>{field === 'start' ? start : end}</AppText>
                  </Pressable>
                ))}
              </View>
              {dateField && <Calendar key={dateField} current={dateField === 'start' ? start : end}
                markedDates={{ [dateField === 'start' ? start : end]: { selected: true, selectedColor: '#0058be' } }}
                onDayPress={day => { if (dateField === 'start') setStart(day.dateString); else setEnd(day.dateString); setDateField(null); }}
                theme={{ todayTextColor: '#0058be', arrowColor: '#0058be' }} />}
              <AppText style={styles.hint}>Includes both dates, using your device&apos;s time zone.</AppText>
            </>}
            {loading ? <View style={styles.loading}><ActivityIndicator color="#0058be" /><AppText>Loading events…</AppText></View>
              : loadError ? <View style={styles.options}>
                <AppText accessibilityRole="alert" style={styles.error}>{loadError}</AppText>
                {userId && <Pressable accessibilityRole="button" onPress={() => { setLoadError(''); setAttempt(value => value + 1); }} style={styles.outlineButton}><AppText style={styles.blueLabel}>Retry</AppText></Pressable>}
              </View>
                : rangeError ? <AppText accessibilityRole="alert" style={styles.error}>{rangeError}</AppText>
                  : <View><AppText accessibilityLiveRegion="polite" style={styles.section}>{events.length} {events.length === 1 ? 'event' : 'events'} selected</AppText>
                    {!events.length && <AppText style={styles.hint}>Try another event type or date range.</AppText>}</View>}
            <AppText style={styles.hint}>Save or share an .ics file. To import into Google Calendar, open its website on a computer and choose Settings → Import &amp; export.</AppText>
            <AppText style={styles.hint}>Exports are a snapshot and won&apos;t update automatically. Events without a date are excluded.</AppText>
            {!!exportError && <AppText accessibilityRole="alert" style={styles.error}>{exportError}</AppText>}
          </ScrollView>
          <View style={styles.footer}>
            <Pressable accessibilityRole="button" accessibilityState={{ disabled, busy }} disabled={disabled} onPress={exportFile}
              style={[styles.exportButton, disabled && styles.disabled]}>
              <AppText style={[styles.exportLabel, disabled && styles.disabledLabel]}>{busy ? 'Preparing export…' : 'Export calendar file'}</AppText>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  entry: { marginHorizontal: 20, marginVertical: 12 },
  outlineButton: { minHeight: 48, padding: 12, borderWidth: 1, borderColor: '#0058be', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  blueLabel: { color: '#0058be', fontWeight: '700', textAlign: 'center' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', paddingHorizontal: 16, justifyContent: 'center', alignItems: 'center' },
  panel: { width: '100%', maxWidth: 520, maxHeight: '100%', backgroundColor: '#fff', borderRadius: 20, overflow: 'hidden', flexShrink: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 20, paddingRight: 8, paddingVertical: 8, borderBottomWidth: 1, borderColor: '#d9e3f2' },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '700', flex: 1 },
  close: { minHeight: 48, minWidth: 64, padding: 10, justifyContent: 'center' },
  content: { padding: 20, gap: 12 },
  section: { fontWeight: '700', color: '#191b23' },
  options: { gap: 8 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, minHeight: 48, borderWidth: 1, borderColor: '#c2c6d6', borderRadius: 12 },
  optionLabel: { flex: 1, color: '#191b23' },
  selected: { backgroundColor: '#edf5ff', borderColor: '#0058be' },
  radio: { width: 22, height: 22, borderWidth: 2, borderColor: '#65758b', borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  radioSelected: { borderColor: '#0058be' },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#0058be' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingVertical: 10, paddingHorizontal: 14, minHeight: 48, justifyContent: 'center', borderWidth: 1, borderColor: '#c2c6d6', borderRadius: 24 },
  dates: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  date: { flexGrow: 1, padding: 12, borderWidth: 1, borderColor: '#c2c6d6', borderRadius: 12, gap: 4 },
  hint: { fontSize: 14, lineHeight: 21, color: '#424754' },
  loading: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  error: { color: '#a61616' },
  footer: { padding: 16, borderTopWidth: 1, borderColor: '#d9e3f2' },
  exportButton: { minHeight: 50, borderRadius: 12, backgroundColor: '#0058be', padding: 12, justifyContent: 'center', alignItems: 'center' },
  exportLabel: { color: '#fff', fontWeight: '700', textAlign: 'center' },
  disabled: { backgroundColor: '#dce9fa' },
  disabledLabel: { color: '#345579' },
});
