import { PropsWithChildren, createContext, useCallback, useContext, useEffect, useRef, useState, type RefObject } from 'react';
import { AccessibilityInfo, ScrollView, View, type ScrollViewProps, type ViewProps } from 'react-native';
import { useIsFocused } from 'expo-router';
import { useGuidedTour } from './guided-tour-provider';

const RevealContext = createContext<(target: RefObject<View | null>) => void>(() => {});

// Measure a non-collapsible native view so Android returns real window coordinates.
export function TourTarget({ id, alwaysActive = false, children, ...props }: PropsWithChildren<ViewProps & { id: string; alwaysActive?: boolean }>) {
  const ref = useRef<View>(null);
  const focused = useIsFocused();
  const reveal = useContext(RevealContext);
  const { register } = useGuidedTour();
  useEffect(() => {
    if (!focused && !alwaysActive) return;
    return register(id, {
      measure: done => ref.current?.measureInWindow((x, y, width, height) => done({ x, y, width, height })),
      reveal: () => reveal(ref),
    });
  }, [id, focused, alwaysActive, register, reveal]);
  return <View {...props} ref={ref} collapsable={false}>{children}</View>;
}

export function TourScrollView({ children, onScroll, ...props }: ScrollViewProps) {
  const ref = useRef<ScrollView>(null);
  const viewport = useRef<View>(null);
  const offset = useRef(0);
  const { active, overview } = useGuidedTour();
  const focused = useIsFocused();
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (alive) setReduceMotion(value); });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => { alive = false; subscription.remove(); };
  }, []);
  useEffect(() => {
    if (active && overview && focused) ref.current?.scrollTo({ y: 0, animated: !reduceMotion });
  }, [active, overview, focused, reduceMotion]);
  // Keep the revealer stable; registration must not reset as screen data loads.
  const reveal = useCallback((target: RefObject<View | null>) => {
    viewport.current?.measureInWindow((_x, scrollY) => {
      target.current?.measureInWindow((_tx, targetY) => {
        ref.current?.scrollTo({ y: Math.max(0, offset.current + targetY - scrollY - 24), animated: !reduceMotion });
      });
    });
  }, [reduceMotion]);
  return (
    <RevealContext.Provider value={reveal}>
      <View ref={viewport} collapsable={false} style={{ flex: 1 }}>
      <ScrollView {...props} ref={ref} scrollEventThrottle={16} onScroll={event => { offset.current = event.nativeEvent.contentOffset.y; onScroll?.(event); }}>
        {children}
      </ScrollView>
      </View>
    </RevealContext.Provider>
  );
}
