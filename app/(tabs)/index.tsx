import { ScrollView, StyleSheet } from 'react-native';

import { ActivityCard } from '@/components/activity-card';
import { AppView } from '@/components/view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

const SAMPLE_ACTIVITIES = [
  {
    id: '1',
    title: 'Grocery Run - Walmart',
    category: 'grocery' as const,
    attendeeCount: 2,
    maxAttendees: 4,
    distance: '1.5 miles away',
    ridesAvailable: 3,
  },
  {
    id: '2',
    title: 'Weekend Pickleball at Lambright',
    category: 'sports' as const,
    host: 'K. Prather',
    date: 'Sat, 7:00 AM',
    attendeeCount: 5,
    maxAttendees: 10,
    distance: '0.8 miles away',
  },
  {
    id: '3',
    title: 'Board Game Night',
    category: 'social' as const,
    host: 'Maya',
    date: 'Fri, 8:00 PM',
    attendeeCount: 3,
    maxAttendees: 8,
    distance: '0.3 miles away',
    ridesAvailable: 1,
  },
  {
    id: '4',
    title: 'Study Group - Calculus II',
    category: 'study' as const,
    attendeeCount: 4,
    maxAttendees: 6,
    distance: '0.1 miles away',
  },
];

export default function HomeScreen() {
  const theme = useColorScheme() ?? 'light';

  return (
    <AppView style={styles.container}>
      <ScrollView
        style={{ backgroundColor: Colors[theme].background }}
        contentContainerStyle={styles.feed}
        showsVerticalScrollIndicator={false}
      >
        {SAMPLE_ACTIVITIES.map((activity) => (
          <ActivityCard key={activity.id} {...activity} />
        ))}
      </ScrollView>
    </AppView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  feed: {
    padding: 16,
    gap: 12,
  },
});
