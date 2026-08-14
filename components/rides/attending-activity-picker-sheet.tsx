import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AttendingActivityCard } from '@/components/rides/attending-activity-card';
import { AppText } from '@/components/text';
import { Colors, Fonts } from '@/constants/theme';
import { useAttendingActivities } from '@/hooks/use-attending-activities';
import { useColorScheme } from '@/hooks/use-color-scheme';

type AttendingActivityPickerSheetProps = {
  visible: boolean;
  title: string;
  subtitle: string;
  onClose: () => void;
  onSelectActivity: (activityId: string) => void;
  onSkip: () => void;
};

export function AttendingActivityPickerSheet({
  visible,
  title,
  subtitle,
  onClose,
  onSelectActivity,
  onSkip,
}: AttendingActivityPickerSheetProps) {
  const theme = useColorScheme() ?? 'light';
  const colors = Colors[theme];
  const insets = useSafeAreaInsets();
  const { activities, loading } = useAttendingActivities();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.container}>
        <Pressable style={styles.backdrop} onPress={onClose} />

        <View
          style={[
            styles.sheet,
            { backgroundColor: colors.surface, paddingBottom: insets.bottom + 16 },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: colors.outlineVariant }]} />

          <View style={styles.header}>
            <AppText style={[styles.title, { color: colors.text, fontFamily: Fonts?.sans }]}>
              {title}
            </AppText>
            <AppText style={[styles.subtitle, { color: colors.icon, fontFamily: Fonts?.sans }]}>
              {subtitle}
            </AppText>
          </View>

          {loading ? (
            <ActivityIndicator color={colors.tint} style={styles.loader} />
          ) : activities.length === 0 ? (
            <AppText style={[styles.emptyText, { color: colors.icon, fontFamily: Fonts?.sans }]}>
              You&apos;re not attending or hosting any upcoming activities yet.
            </AppText>
          ) : (
            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.grid}
              showsVerticalScrollIndicator={false}
            >
              {activities.map((activity) => (
                <AttendingActivityCard
                  key={activity.id}
                  title={activity.title}
                  category={activity.category}
                  dateLabel={activity.dateLabel}
                  location={activity.location}
                  onPress={() => onSelectActivity(activity.id)}
                />
              ))}
            </ScrollView>
          )}

          <TouchableOpacity
            onPress={onSkip}
            style={[styles.skipButton, { borderColor: colors.outlineVariant }]}
          >
            <AppText style={[styles.skipText, { color: colors.text, fontFamily: Fonts?.sans }]}>
              Continue without an activity
            </AppText>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 8,
    maxHeight: '85%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12,
  },
  header: {
    gap: 4,
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  loader: {
    marginVertical: 24,
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
    marginVertical: 12,
  },
  scrollView: {
    maxHeight: 360,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingBottom: 20,
  },
  skipButton: {
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  skipText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
