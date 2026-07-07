import { useState } from 'react';
import { ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActivityCard } from '@/components/activity-card';
import { AppText } from '@/components/text';
import { AppView } from '@/components/view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

const CATEGORIES = ['All', 'Social', 'Sports', 'Music', 'Study', 'Outdoor', 'Gaming'];

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
];

export default function HomeScreen() {
  const theme = useColorScheme() ?? 'light';
  const colors = Colors[theme];
  const insets = useSafeAreaInsets();
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <AppView style={styles.container}>
      <ScrollView
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 8 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={[styles.avatar, { backgroundColor: colors.primaryContainer }]} />
          <AppText style={[styles.logo, { color: colors.tint, fontFamily: Fonts?.rounded }]}>
            Rollin'
          </AppText>
          <TouchableOpacity hitSlop={8}>
            <IconSymbol name="bell.fill" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Greeting */}
        <View style={styles.greeting}>
          <AppText style={[styles.greetingName, { color: colors.text, fontFamily: Fonts?.sans }]}>
            Hey, Saphal
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
          <TouchableOpacity style={[styles.filterButton, { borderColor: colors.outlineVariant, backgroundColor: theme === 'light' ? '#ffffff' : colors.surfaceContainer }]}>
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
                { color: selectedCategory === cat ? '#ffffff' : colors.text, fontFamily: Fonts?.sans },
              ]}>
                {cat}
              </AppText>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Featured section */}
        <AppText style={[styles.sectionHeading, { color: colors.text, fontFamily: Fonts?.sans }]}>
          Featured
        </AppText>
        <View style={[styles.featuredCard, { backgroundColor: '#4a7c59' }]}>
          {/* Ride sharing badge */}
          <View style={[styles.rideBadge, { backgroundColor: colors.secondaryContainer }]}>
            <IconSymbol name="car.fill" size={12} color={colors.onSecondaryContainer} />
            <AppText style={[styles.rideBadgeText, { color: colors.onSecondaryContainer, fontFamily: Fonts?.sans }]}>
              Ride sharing available
            </AppText>
          </View>

          {/* Bottom overlay */}
          <View style={styles.featuredOverlay}>
            <View style={styles.hostRow}>
              <View style={[styles.hostAvatar, { backgroundColor: colors.primaryContainer }]} />
              <AppText style={[styles.hostedBy, { fontFamily: Fonts?.sans }]}>Hosted by K. Prather</AppText>
            </View>
            <AppText style={[styles.featuredTitle, { fontFamily: Fonts?.sans }]}>Hike to Lost Valley</AppText>
            <View style={styles.joinedRow}>
              <IconSymbol name="person.2.fill" size={14} color="#ffffff" />
              <AppText style={[styles.joinedText, { fontFamily: Fonts?.sans }]}>3 people joined</AppText>
            </View>
          </View>
        </View>

        {/* Recommended section */}
        <AppText style={[styles.sectionHeading, { color: colors.text, fontFamily: Fonts?.sans }]}>
          Recommended for you
        </AppText>
        <View style={styles.cardList}>
          {SAMPLE_ACTIVITIES.map((activity) => (
            <ActivityCard key={activity.id} {...activity} />
          ))}
        </View>
      </ScrollView>
    </AppView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  logo: {
    fontSize: 22,
    fontWeight: '700',
  },
  greeting: {
    gap: 2,
  },
  greetingName: {
    fontSize: 16,
  },
  greetingQuestion: {
    fontSize: 20,
    fontWeight: '700',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
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
  searchInput: {
    flex: 1,
    fontSize: 15,
    padding: 0,
  },
  filterButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pills: {
    gap: 8,
    paddingRight: 16,
  },
  pill: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  pillText: {
    fontSize: 14,
    fontWeight: '500',
  },
  sectionHeading: {
    fontSize: 18,
    fontWeight: '700',
  },
  featuredCard: {
    borderRadius: 12,
    height: 180,
    overflow: 'hidden',
    justifyContent: 'space-between',
    padding: 12,
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
  rideBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  featuredOverlay: {
    gap: 4,
  },
  hostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  hostAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  hostedBy: {
    fontSize: 12,
    color: '#ffffff',
  },
  featuredTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#ffffff',
  },
  joinedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  joinedText: {
    fontSize: 13,
    color: '#ffffff',
  },
  cardList: {
    gap: 12,
  },
});
