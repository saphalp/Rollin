import { useEffect, useRef } from 'react';
import { View, type ViewInstance } from 'react-native';
import { useGuidedTour } from '@/components/tutorial/guided-tour-provider';
import { PlatformPressable } from 'expo-router/react-navigation';
import { BottomTabBarButtonProps } from 'expo-router/tabs';
import * as Haptics from 'expo-haptics';

export function HapticTab({ tourId, ...props }: BottomTabBarButtonProps & { tourId?: string }) {
  const ref = useRef<ViewInstance>(null);
  const { register } = useGuidedTour();
  useEffect(() => {
    if (!tourId) return;
    return register(tourId, {
      measure: done => ref.current?.measureInWindow((x: number, y: number, width: number, height: number) => done({ x, y, width, height })),
      reveal() {},
    });
  }, [tourId, register]);
  return (
    <PlatformPressable
      ref={ref as any}
      collapsable={false}
      {...props}
      onPressIn={(ev) => {
        if (process.env.EXPO_OS === 'ios') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        props.onPressIn?.(ev);
      }}
    />
  );
}
