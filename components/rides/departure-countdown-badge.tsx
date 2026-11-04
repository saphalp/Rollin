import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Animated, StyleSheet } from 'react-native';

import { AppText } from '@/components/text';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

// Only show the badge when the ride leaves within this many minutes.
const WINDOW_MINUTES = 60;

type Props = {
  dateTime: string | null;
};

export function DepartureCountdownBadge({ dateTime }: Props) {
  const theme = useColorScheme() ?? 'light';
  const colors = Colors[theme];
  const [now, setNow] = useState(() => Date.now());
  // 0 = normal shade, 1 = darker shade. Animated back and forth to make the badge flash.
  const [pulse] = useState(() => new Animated.Value(0));

  // Re-check the time every 30 seconds so the countdown stays current.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const departure = dateTime ? new Date(dateTime).getTime() : NaN;
  const minutesLeft = Number.isNaN(departure) ? null : Math.ceil((departure - now) / 60_000);
  const visible = minutesLeft !== null && minutesLeft <= WINDOW_MINUTES;
  const departed = minutesLeft !== null && minutesLeft <= 0;
  // Only flash while the ride is leaving soon (not after it has departed).
  const flashing = visible && !departed;

  useEffect(() => {
    if (!flashing) {
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 400, useNativeDriver: false }),
        Animated.timing(pulse, { toValue: 0, duration: 400, useNativeDriver: false }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [flashing, pulse]);

  if (!visible) return null;

  const label = departed
    ? 'Departed'
    : `Leaving in ${minutesLeft} ${minutesLeft === 1 ? 'min' : 'mins'}`;
  const color = departed ? colors.icon : colors.error;

  // Fade between the light red and a deeper red while leaving soon.
  const backgroundColor = departed
    ? colors.surfaceContainerHigh
    : pulse.interpolate({
        inputRange: [0, 1],
        outputRange: [colors.errorContainer, colors.errorPulse],
      });

  return (
    <Animated.View style={[styles.badge, { backgroundColor }]}>
      <MaterialCommunityIcons name={departed ? 'car-off' : 'timer-sand'} size={14} color={color} />
      <AppText style={[styles.text, { color, fontFamily: Fonts?.sans }]}>{label}</AppText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  text: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
});