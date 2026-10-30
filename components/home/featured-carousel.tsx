import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useIsFocused } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppState,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  type ScrollViewInstance,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';

import { AppText } from '@/components/text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export type FeaturedActivity = {
  id: string;
  title: string;
  date?: string;
  location?: string;
  host?: string;
  imageUrl?: string;
  attendeeCount: number;
  maxAttendees: number;
  rideSharing?: boolean;
};

type Props = {
  activities: FeaturedActivity[];
  onPress: (activity: FeaturedActivity) => void;
};

const GUTTER = 16; // matches the tab scene's horizontal padding
// Gap between cards equals both gutters, so each page is exactly one viewport wide and the
// neighbouring cards stay fully off-screen.
const GAP = GUTTER * 2;
const CARD_ASPECT = 1; // width / height
const AUTOPLAY_MS = 4000;
const EPSILON = 0.01;

export function FeaturedCarousel({ activities, onPress }: Props) {
  const [width, setWidth] = useState(0);
  const count = activities.length;

  function onLayout(e: LayoutChangeEvent) {
    setWidth(e.nativeEvent.layout.width);
  }

  if (count === 0) return null;

  if (count === 1) {
    return (
      <View onLayout={onLayout}>
        {width > 0 && (
          <FeaturedCard activity={activities[0]} width={width} onPress={() => onPress(activities[0])} />
        )}
      </View>
    );
  }

  return (
    <View style={styles.bleed} onLayout={onLayout}>
      {width > 0 && (
        <LoopingCarousel
          // Remount when the featured set changes so the carousel restarts on the first card.
          key={activities.map(a => a.id).join(',')}
          activities={activities}
          viewportWidth={width}
          onPress={onPress}
        />
      )}
    </View>
  );
}

function LoopingCarousel({
  activities,
  viewportWidth,
  onPress,
}: Props & { viewportWidth: number }) {
  const theme = useColorScheme() ?? 'light';
  const colors = Colors[theme];
  const focused = useIsFocused();
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  const [activeIndex, setActiveIndex] = useState(0);

  const n = activities.length;
  const cardWidth = viewportWidth - GUTTER * 2;
  const interval = cardWidth + GAP;
  // [last, ...items, first]: a clone at each end so swiping past either edge wraps around.
  const slides = [activities[n - 1], ...activities, activities[0]];

  const scrollRef = useRef<ScrollViewInstance>(null);
  const offset = useRef(interval);
  const dragging = useRef(false);
  const positioned = useRef(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopAutoplay = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  }, []);

  const startAutoplay = useCallback(() => {
    stopAutoplay();
    if (!focused || !appActive) return;
    timer.current = setInterval(() => {
      if (dragging.current) return;
      const next = Math.round(offset.current / interval) + 1;
      scrollRef.current?.scrollTo({ x: next * interval, animated: true });
    }, AUTOPLAY_MS);
  }, [appActive, focused, interval, stopAutoplay]);

  useEffect(() => {
    startAutoplay();
    return stopAutoplay;
  }, [startAutoplay, stopAutoplay]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', state => setAppActive(state === 'active'));
    return () => sub.remove();
  }, []);

  function onScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const x = e.nativeEvent.contentOffset.x;
    offset.current = x;
    const pos = x / interval;
    setActiveIndex((((Math.round(pos) - 1) % n) + n) % n);

    // Once a clone has settled into place, silently jump to the matching real card.
    if (dragging.current) return;
    if (pos >= n + 1 - EPSILON) jumpTo(x - n * interval);
    else if (pos <= EPSILON) jumpTo(x + n * interval);
  }

  function jumpTo(x: number) {
    offset.current = x;
    scrollRef.current?.scrollTo({ x, animated: false });
  }

  function goTo(index: number) {
    scrollRef.current?.scrollTo({ x: (index + 1) * interval, animated: true });
    startAutoplay();
  }

  return (
    <View style={styles.carousel}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentOffset={{ x: interval, y: 0 }}
        // Fallback for platforms that ignore contentOffset: start on the first real card.
        onContentSizeChange={() => {
          if (!positioned.current) jumpTo(interval);
          positioned.current = true;
        }}
        snapToInterval={interval}
        decelerationRate="fast"
        disableIntervalMomentum
        scrollEventThrottle={16}
        onScroll={onScroll}
        onScrollBeginDrag={() => {
          dragging.current = true;
          stopAutoplay();
        }}
        onScrollEndDrag={() => {
          dragging.current = false;
          startAutoplay();
        }}
        contentContainerStyle={styles.track}
      >
        {slides.map((activity, i) => (
          <FeaturedCard
            key={`${activity.id}-${i}`}
            activity={activity}
            width={cardWidth}
            onPress={() => onPress(activity)}
          />
        ))}
      </ScrollView>

      <View style={styles.dots}>
        {activities.map((activity, i) => {
          const active = i === activeIndex;
          return (
            <Pressable
              key={activity.id}
              onPress={() => goTo(i)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`Show featured ${i + 1} of ${n}`}
              style={[
                styles.dot,
                active
                  ? { width: 18, backgroundColor: colors.tint }
                  : { backgroundColor: colors.outlineVariant },
              ]}
            />
          );
        })}
      </View>
    </View>
  );
}

function FeaturedCard({
  activity,
  width,
  onPress,
}: {
  activity: FeaturedActivity;
  width: number;
  onPress: () => void;
}) {
  const theme = useColorScheme() ?? 'light';
  const colors = Colors[theme];

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={[styles.card, { width, height: Math.round(width / CARD_ASPECT), backgroundColor: colors.primaryContainer }]}
    >
      {activity.imageUrl ? (
        <Image
          source={{ uri: activity.imageUrl }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
      ) : null}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.35)', 'rgba(0,0,0,0.8)']}
        locations={[0.35, 0.6, 1]}
        style={StyleSheet.absoluteFill}
      />

      {activity.rideSharing ? (
        <View style={[styles.rideBadge, { backgroundColor: colors.secondaryContainer }]}>
          <IconSymbol name="car.fill" size={12} color={colors.onSecondaryContainer} />
          <AppText style={[styles.rideBadgeText, { color: colors.onSecondaryContainer, fontFamily: Fonts?.sans }]}>
            Ride sharing available
          </AppText>
        </View>
      ) : (
        <View />
      )}

      <View style={styles.overlay}>
        {activity.host && (
          <View style={styles.row}>
            <View style={[styles.hostAvatar, { backgroundColor: colors.tint }]} />
            <AppText style={[styles.meta, { fontFamily: Fonts?.sans, color: colors.onImageOverlay }]}>
              Hosted by {activity.host}
            </AppText>
          </View>
        )}
        <AppText numberOfLines={2} style={[styles.title, { fontFamily: Fonts?.sans, color: colors.onImageOverlay }]}>
          {activity.title}
        </AppText>
        {activity.date && (
          <View style={styles.row}>
            <IconSymbol name="calendar" size={14} color={colors.onImageOverlay} />
            <AppText style={[styles.meta, { fontFamily: Fonts?.sans, color: colors.onImageOverlay }]}>
              {activity.date}
            </AppText>
          </View>
        )}
        {!!activity.location && (
          <View style={styles.row}>
            <IconSymbol name="mappin" size={14} color={colors.onImageOverlay} />
            <AppText numberOfLines={1} style={[styles.meta, styles.shrink, { fontFamily: Fonts?.sans, color: colors.onImageOverlay }]}>
              {activity.location}
            </AppText>
          </View>
        )}
        <View style={styles.row}>
          <IconSymbol name="person.2.fill" size={14} color={colors.onImageOverlay} />
          <AppText style={[styles.meta, { fontFamily: Fonts?.sans, color: colors.onImageOverlay }]}>
            {activity.attendeeCount}/{activity.maxAttendees} joined
          </AppText>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  bleed: { marginHorizontal: -GUTTER },
  carousel: { gap: 12 },
  track: { paddingHorizontal: GUTTER, gap: GAP },
  dots: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  card: {
    borderRadius: 16,
    overflow: 'hidden',
    justifyContent: 'space-between',
    padding: 16,
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
  rideBadgeText: { fontSize: 12, lineHeight: 16, fontWeight: '600' },
  overlay: { gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  hostAvatar: { width: 20, height: 20, borderRadius: 10 },
  title: { fontSize: 24, lineHeight: 30, fontWeight: '700' },
  meta: { fontSize: 13, lineHeight: 18 },
  shrink: { flexShrink: 1 },
});
