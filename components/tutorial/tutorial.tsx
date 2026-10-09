import { TourButton } from './tour-button';
import { useLayoutEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { overviewLayout, spotlightLayout, TUTORIAL_STEPS, type TourRect } from './tutorial-steps';

type Target = { measure: (done: (rect: TourRect) => void) => void; reveal: () => void };
type Props = {
  step: number; readyRoute: boolean; getTarget: () => Target | undefined;
  saving: boolean; error: boolean; onBack: () => void; onNext: () => void;
  onReturnToPage: () => void; onSkip: () => void; onContinueWithoutSaving: () => void;
};

export function Tutorial({ step, readyRoute, getTarget, saving, error, onBack, onNext, onReturnToPage, onSkip, onContinueWithoutSaving }: Props) {
  const colors = Colors[useColorScheme() ?? 'light'];
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const { fontScale } = window;
  const root = useRef<View>(null);
  const [size, setSize] = useState({ width: window.width, height: window.height });
  const [rect, setRect] = useState<TourRect | null>(null);
  const [cardHeight, setCardHeight] = useState(0);
  const current = TUTORIAL_STEPS[step];
  const overview = !current.target;
  const interaction = !!current.destination;
  const stackButtons = fontScale > 1.3 || size.width < 380;
  const page = TUTORIAL_STEPS.slice(0, step + 1).filter(item => !item.target).length;
  const pages = TUTORIAL_STEPS.filter(item => !item.target).length;

  useLayoutEffect(() => {
    let alive = true;
    let frame = 0;
    let revealed: Target | undefined;
    function measure() {
      if (!alive) return;
      if (readyRoute) {
        const target = getTarget();
        if (target) {
          if (revealed !== target) { revealed = target; if (!overview) target.reveal(); }
          root.current?.measureInWindow((rootX, rootY) => {
            target.measure(value => {
              if (!alive || value.width <= 0 || value.height <= 0) return;
              const next = { ...value, x: value.x - rootX, y: value.y - rootY };
              if (next.y >= size.height || next.y + next.height <= 0) return;
              setRect(old => old && Object.keys(next).every(key => Math.abs(old[key as keyof TourRect] - next[key as keyof TourRect]) < 1) ? old : next);
            });
          });
        }
      }
      frame = requestAnimationFrame(measure);
    }
    measure();
    return () => { alive = false; cancelAnimationFrame(frame); };
  }, [overview, readyRoute, getTarget, size.height, size.width]);

  const { hole, cardTop } = spotlightLayout(interaction && !current.target?.startsWith('tab-') && rect ? { x: rect.x - 6, y: rect.y - 6, width: rect.width + 12, height: rect.height + 12 } : rect, size.width, size.height, insets.top, insets.bottom);
  const note = overviewLayout(rect, size.width, size.height, insets.top, insets.bottom, current.placement);
  const width = size.width - 32;
  const safeTop = insets.top + 12;
  const safeBottom = size.height - insets.bottom - 12;
  const preferredTop = overview ? ('bottom' in note.card ? size.height - note.card.bottom - cardHeight : note.card.top) : cardTop;
  const top = Math.max(safeTop, Math.min(preferredTop, safeBottom - cardHeight));
  const overlapsTarget = !!hole && top < hole.y + hole.height && top + cardHeight > hole.y;
  // Preserve tappable navigation targets if a note needs more room than the default placement.
  const finalTop = overview && current.placement === 'below' && rect
    ? rect.y + rect.height + 16
    : interaction && hole && overlapsTarget
    ? (hole.y > size.height / 2 ? Math.max(safeTop, hole.y - cardHeight - 12) : hole.y + hole.height + 12)
    : top;
  const path = `M0 0H${size.width}V${size.height}H0Z` + (hole ? `M${hole.x} ${hole.y}h${hole.width}v${hole.height}h-${hole.width}Z` : '');
  return (
    <View ref={root} collapsable={false} style={styles.overlay} pointerEvents={overview || interaction ? 'box-none' : 'auto'} accessibilityViewIsModal={!overview && !interaction} onLayout={event => setSize(event.nativeEvent.layout)}>
      {!overview && !interaction && <Pressable style={StyleSheet.absoluteFill} accessible={false} onPress={() => {}} />}
      {interaction && hole && <>
        <Pressable accessible={false} onPress={() => {}} style={[styles.blocker, { top: 0, left: 0, right: 0, height: hole.y }]} />
        <Pressable accessible={false} onPress={() => {}} style={[styles.blocker, { top: hole.y + hole.height, left: 0, right: 0, bottom: 0 }]} />
        <Pressable accessible={false} onPress={() => {}} style={[styles.blocker, { top: hole.y, left: 0, width: hole.x, height: hole.height }]} />
        <Pressable accessible={false} onPress={() => {}} style={[styles.blocker, { top: hole.y, left: hole.x + hole.width, right: 0, height: hole.height }]} />
      </>}
      <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
        {!overview && <Svg width={size.width} height={size.height} style={StyleSheet.absoluteFill} pointerEvents="none">
          <Path d={path} fill="rgba(0,0,0,0.72)" fillRule="evenodd" />
        </Svg>}
        {!overview && hole && <View pointerEvents="none" style={[styles.highlight, { left: hole.x, top: hole.y, width: hole.width, height: hole.height, borderColor: colors.tint }]} />}
        {overview && rect && cardHeight > 0 && <View pointerEvents="none" style={[styles.arrow, { left: note.arrowX - 8, top: (note.above ? finalTop + cardHeight : finalTop - 16), borderTopColor: note.above ? colors.cardBackground : 'transparent', borderBottomColor: note.above ? 'transparent' : colors.cardBackground }]} />}
        <View onLayout={event => setCardHeight(event.nativeEvent.layout.height)} style={[styles.card, { top: finalTop, left: 16, width, backgroundColor: colors.cardBackground, borderColor: colors.outlineVariant }]}>
          <View style={styles.content}>
            <View style={styles.heading}>
              <Text style={{ color: colors.icon, flexShrink: 1 }}>Page {page} of {pages} - {overview ? 'Overview' : 'Details'}</Text>
              <TourButton disabled={saving} onPress={onSkip}>Skip</TourButton>
            </View>
            <Text accessibilityRole="header" accessibilityLiveRegion="polite" style={[styles.title, { color: colors.text }]}>{current.title}</Text>
            <Text style={[styles.description, { color: colors.text }]}>{current.description}</Text>
            {overview && !readyRoute && <TourButton onPress={onReturnToPage}>Return to this page</TourButton>}
            {error && <>
              <Text accessibilityRole="alert" style={{ color: colors.error }}>Could not save. Try again or continue without saving.</Text>
              <TourButton onPress={onContinueWithoutSaving} disabled={saving}>Continue without saving</TourButton>
            </>}
            {saving && <Text accessibilityLiveRegion="polite" style={{ color: colors.icon }}>Saving...</Text>}
            <View style={[styles.actions, stackButtons && styles.stacked]}>
              <View style={[styles.action, stackButtons && styles.stackedAction]}><TourButton disabled={step === 0 || saving} onPress={onBack}>Back</TourButton></View>
              {!interaction && <View style={[styles.action, stackButtons && styles.stackedAction]}><TourButton primary disabled={saving} onPress={onNext}>{step === TUTORIAL_STEPS.length - 1 ? 'Finish' : 'Next'}</TourButton></View>}
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, zIndex: 1000, elevation: 1000 },
  highlight: { position: 'absolute', borderWidth: 2, borderRadius: 8 },
  arrow: { position: 'absolute', width: 0, height: 0, borderLeftWidth: 8, borderRightWidth: 8, borderTopWidth: 8, borderBottomWidth: 8, borderLeftColor: 'transparent', borderRightColor: 'transparent' },
  card: { position: 'absolute', borderWidth: 1, borderRadius: 18, elevation: 6, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  content: { padding: 16, gap: 8 },
  blocker: { position: 'absolute' },
  heading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 },
  actions: { flexDirection: 'row', gap: 12 },
  stacked: { flexDirection: 'column' },
  action: { flex: 1, minWidth: 0 },
  stackedAction: { flexGrow: 0, flexShrink: 0, flexBasis: 'auto' },
  title: { fontSize: 20, fontWeight: '700' },
  description: { fontSize: 16, lineHeight: 23 },
});
