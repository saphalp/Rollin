import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

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

  // Re-check the time every 30 seconds so the countdown stays current.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  if (!dateTime) return null;
  const departure = new Date(dateTime).getTime();
  if (Number.isNaN(departure)) return null;

  const minutesLeft = Math.ceil((departure - now) / 60_000);
  if (minutesLeft > WINDOW_MINUTES) return null;

  const departed = minutesLeft <= 0;
  const label = departed
    ? 'Departed'
    : `Leaving in ${minutesLeft} ${minutesLeft === 1 ? 'min' : 'mins'}`;
  const color = departed ? colors.icon : colors.error;

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: departed ? colors.surfaceContainerHigh : colors.errorContainer },
      ]}
    >
      <MaterialCommunityIcons name={departed ? 'car-off' : 'timer-sand'} size={14} color={color} />
      <AppText style={[styles.text, { color, fontFamily: Fonts?.sans }]}>{label}</AppText>
    </View>
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