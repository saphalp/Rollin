import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/components/text';
import { scheduleTimeLabel, type ScheduleWarning } from '@/lib/schedule-conflicts';

type Props = { warning: ScheduleWarning | null; userId: string | null; privateRequest: boolean; onGoBack: () => void; onContinue: () => void };

export function ScheduleConflictDialog({ warning, userId, privateRequest, onGoBack, onContinue }: Props) {
  const insets = useSafeAreaInsets();
  if (!warning) return null;
  return (
    <Modal transparent visible animationType="fade" onRequestClose={onGoBack}>
      <View style={[styles.backdrop, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.card} accessibilityViewIsModal>
          <AppText accessibilityRole="header" style={styles.title}>Possible schedule conflict</AppText>
          <ScrollView contentContainerStyle={styles.body}>
            <AppText style={styles.text}>You&apos;re about to {privateRequest ? 'request to join' : 'join'}:</AppText>
            <View style={styles.target}>
              <AppText style={styles.name}>{warning.target.title}</AppText>
              <AppText style={styles.time}>{scheduleTimeLabel(warning.target.date_time!)}</AppText>
            </View>
            <AppText style={styles.text}>These activities you&apos;ve joined or are hosting start within 60 minutes of it:</AppText>
            {warning.conflicts.map(activity => <View key={activity.id} style={styles.conflict}>
              <AppText style={styles.name}>{activity.title}</AppText>
              <AppText style={styles.time}>{scheduleTimeLabel(activity.date_time!)}</AppText>
              <AppText style={styles.role}>{activity.host_id === userId ? 'You are hosting' : 'You have joined'}</AppText>
            </View>)}
            <AppText style={styles.text}>You can still {privateRequest ? 'send your request' : 'join'} if this works for your schedule.</AppText>
          </ScrollView>
          <View style={styles.actions}>
            <Pressable accessibilityRole="button" onPress={onGoBack} style={styles.secondary}><AppText style={styles.secondaryText}>Go back</AppText></Pressable>
            <Pressable accessibilityRole="button" onPress={onContinue} style={styles.primary}><AppText style={styles.primaryText}>{privateRequest ? 'Request anyway' : 'Join anyway'}</AppText></Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, paddingHorizontal: 20, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center' },
  card: { width: '100%', maxWidth: 500, maxHeight: '100%', flexShrink: 1, borderRadius: 20, backgroundColor: '#fff', overflow: 'hidden' },
  title: { padding: 20, fontSize: 22, lineHeight: 28, fontWeight: '700', color: '#191b23' },
  body: { paddingHorizontal: 20, paddingBottom: 12, gap: 12 },
  text: { color: '#424754' },
  target: { padding: 12, borderRadius: 12, backgroundColor: '#edf5ff', gap: 4 },
  conflict: { borderLeftWidth: 3, borderLeftColor: '#b97000', paddingLeft: 12, paddingVertical: 4, gap: 4 },
  name: { fontWeight: '700', color: '#191b23' },
  time: { fontSize: 14, lineHeight: 21, color: '#424754' },
  role: { fontSize: 13, lineHeight: 20, color: '#0058be' },
  actions: { padding: 20, gap: 10 },
  primary: { minHeight: 48, borderRadius: 12, padding: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0058be' },
  secondary: { minHeight: 48, borderRadius: 12, padding: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#0058be' },
  primaryText: { fontWeight: '700', color: '#fff', textAlign: 'center' },
  secondaryText: { fontWeight: '700', color: '#0058be', textAlign: 'center' },
});
