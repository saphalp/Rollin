import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { AppText } from '@/components/text';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type Props = {
  joined: number;
  max: number;
  size?: number;
};

// Circular progress ring showing how full an activity is (e.g. "80%").
export function AvailabilityRing({ joined, max, size = 52 }: Props) {
  const colors = Colors[useColorScheme() ?? 'light'];
  const stroke = 5;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const percent = max > 0 ? Math.min(100, Math.round((joined / max) * 100)) : 0;
  // How much of the ring is left unfilled.
  const offset = circumference * (1 - percent / 100);

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        {/* Gray track */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.outlineVariant}
          strokeWidth={stroke}
          fill="none"
        />
        {/* Blue filled part, starting from the top */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.tint}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={styles.label}>
        <AppText style={[styles.percent, { color: colors.tint, fontFamily: Fonts?.sans }]}>
          {percent}%
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  percent: { fontSize: 12, lineHeight: 16, fontWeight: '700' },
});