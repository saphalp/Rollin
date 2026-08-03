import { router } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { AttendingActivityCard } from '@/components/rides/attending-activity-card';
import { AppText } from '@/components/text';
import { Colors, Fonts } from '@/constants/theme';
import { useAttendingActivities } from '@/hooks/use-attending-activities';
import { useColorScheme } from '@/hooks/use-color-scheme';

export function AttendingActivities() {
  const theme = useColorScheme() ?? 'light';
  const colors = Colors[theme];
  const { activities, loading, currentUserId } = useAttendingActivities();

  if (!currentUserId || (!loading && activities.length === 0)) {
    return null;
  }

  return (
    <View style={styles.container}>
      <AppText style={[styles.heading, { color: colors.text, fontFamily: Fonts?.sans }]}>
        Activities You&apos;re Attending
      </AppText>

      {loading ? (
        <ActivityIndicator color={colors.tint} style={styles.loader} />
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.list}
        >
          {activities.map((activity) => (
            <AttendingActivityCard
              key={activity.id}
              title={activity.title}
              category={activity.category}
              dateLabel={activity.dateLabel}
              location={activity.location}
              onPress={() => router.push(`/activity/${activity.id}`)}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  heading: {
    fontSize: 18,
    fontWeight: '700',
  },
  list: {
    gap: 12,
    paddingRight: 4,
  },
  loader: {
    marginVertical: 12,
    alignSelf: 'flex-start',
  },
});
