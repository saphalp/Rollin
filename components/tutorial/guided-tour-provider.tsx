import { PropsWithChildren, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Keyboard, View } from 'react-native';
import { router, usePathname, type Href } from 'expo-router';
import { useAuthContext } from '@/hooks/use-auth-context';
import { finishTutorial, hasFinishedTutorial, type TutorialOutcome } from '@/lib/tutorial';
import { TUTORIAL_STEPS, tourHref, type TourRect } from './tutorial-steps';
import { Tutorial } from './tutorial';

type Target = { measure: (done: (rect: TourRect) => void) => void; reveal: () => void };
type TourContextValue = {
  active: boolean;
  overview: boolean;
  promptsBlocked: boolean;
  start: () => void;
  register: (id: string, target: Target) => () => void;
};
const TourContext = createContext<TourContextValue>({ active: false, overview: false, promptsBlocked: false, start() {}, register: () => () => {} });
export const useGuidedTour = () => useContext(TourContext);
const TAB_PATHS = ['/', '/explore', '/post', '/rides', '/chats', '/profile', '/notifications'];

export function GuidedTourProvider({ children }: PropsWithChildren) {
  const { claims, isLoggedIn, isProfileComplete } = useAuthContext();
  const userId = typeof claims?.sub === 'string' ? claims.sub : undefined;
  return <TourSession key={userId ?? 'signed-out'} userId={userId} eligible={isLoggedIn && isProfileComplete}>{children}</TourSession>;
}

function TourSession({ userId, eligible, children }: PropsWithChildren<{ userId?: string; eligible: boolean }>) {
  const pathname = usePathname();
  const [step, setStep] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const registry = useRef(new Map<string, Target>());
  const replay = useRef(false);
  const busy = useRef(false);
  const alive = useRef(true);
  const lookupVersion = useRef(0);
  const armedStep = useRef<number | null>(null);
  const active = eligible && step !== null;
  const overview = active && step !== null && !TUTORIAL_STEPS[step].target;
  const interaction = active && step !== null && !!TUTORIAL_STEPS[step].destination;
  const canCheck = eligible && !!userId && TAB_PATHS.includes(pathname);

  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const register = useCallback((id: string, target: Target) => {
    registry.current.set(id, target);
    return () => { if (registry.current.get(id) === target) registry.current.delete(id); };
  }, []);

  const start = useCallback(() => {
    if (!eligible || !userId) return;
    lookupVersion.current++;
    replay.current = true;
    setChecked(true);
    setError(false);
    setStep(0);
    Keyboard.dismiss();
    router.replace('/(tabs)');
  }, [eligible, userId]);

  useEffect(() => {
    if (!canCheck || checked || !userId) return;
    const version = ++lookupVersion.current;
    let pending = true;
    function resolve(done: boolean) {
      if (!pending || version !== lookupVersion.current) return;
      pending = false;
      setChecked(true);
      if (!done) { replay.current = false; Keyboard.dismiss(); setStep(0); router.replace('/(tabs)'); }
    }
    const timeout = setTimeout(() => resolve(false), 8000);
    void hasFinishedTutorial(userId).then(resolve, () => resolve(false)).finally(() => clearTimeout(timeout));
    return () => { pending = false; clearTimeout(timeout); };
  }, [canCheck, checked, userId]);

  function move(next: number) {
    if (busy.current || next < 0 || next >= TUTORIAL_STEPS.length) return;
    Keyboard.dismiss();
    setError(false);
    setStep(next);
    if (pathname !== TUTORIAL_STEPS[next].route) router.replace(tourHref(TUTORIAL_STEPS[next].route) as Href);
  }

  useEffect(() => {
    if (!active || step === null) return;
    const destination = TUTORIAL_STEPS[step].destination;
    if (destination && pathname === TUTORIAL_STEPS[step].route) armedStep.current = step;
    if (destination && armedStep.current === step && pathname === destination) {
      armedStep.current = null;
      setStep(step + 1);
      setError(false);
    }
  }, [active, step, pathname]);

  async function finish(outcome: TutorialOutcome) {
    if (busy.current || !userId) return;
    busy.current = true;
    setSaving(true);
    setError(false);
    try {
      if (!replay.current) await finishTutorial(userId, outcome);
      if (alive.current) setStep(null);
    } catch {
      if (alive.current) setError(true);
    } finally {
      busy.current = false;
      if (alive.current) setSaving(false);
    }
  }

  useEffect(() => {
    if (!active || overview) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => subscription.remove();
  }, [active, overview]);

  const context = useMemo(() => ({ active, overview, promptsBlocked: active || (canCheck && !checked), start, register }), [active, overview, canCheck, checked, start, register]);
  return (
    <TourContext.Provider value={context}>
      <View style={{ flex: 1 }}>
        <View style={{ flex: 1 }} accessibilityElementsHidden={active && !overview && !interaction} importantForAccessibility={active && !overview && !interaction ? 'no-hide-descendants' : 'auto'}>
          {children}
        </View>
        {active && step !== null && (
          <Tutorial
            key={step}
            step={step}
            readyRoute={pathname === TUTORIAL_STEPS[step].route}
            getTarget={() => registry.current.get(TUTORIAL_STEPS[step].target ?? TUTORIAL_STEPS[step].anchor ?? '')}
            saving={saving}
            error={error}
            onBack={() => move(step - 1)}
            onNext={() => TUTORIAL_STEPS[step].destination ? undefined : step === TUTORIAL_STEPS.length - 1 ? void finish('completed') : move(step + 1)}
            onReturnToPage={() => router.replace(tourHref(TUTORIAL_STEPS[step].route) as Href)}
            onSkip={() => void finish('skipped')}
            onContinueWithoutSaving={() => setStep(null)}
          />
        )}
      </View>
    </TourContext.Provider>
  );
}
