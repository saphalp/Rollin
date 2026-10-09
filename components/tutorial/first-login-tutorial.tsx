import { PropsWithChildren, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { finishTutorial, hasFinishedTutorial, type TutorialOutcome } from '@/lib/tutorial';
import { Tutorial } from './tutorial';

// The parent keys this component by account so one user's result never skips another user's guide.
export function FirstLoginTutorial({ userId, children }: PropsWithChildren<{ userId: string }>) {
  const [status, setStatus] = useState<'loading' | 'show' | 'done'>('loading');
  const colors = Colors[useColorScheme() ?? 'light'];

  useEffect(() => {
    let active = true;
    // A failed lookup must not lock the user out of the app.
    const timeout = setTimeout(() => {
      if (active) setStatus('show');
      active = false; // Ignore a late lookup after the user has started or dismissed the guide.
    }, 8000);
    void hasFinishedTutorial(userId).then(
      done => { if (active) setStatus(done ? 'done' : 'show'); },
      () => { if (active) setStatus('show'); },
    ).finally(() => clearTimeout(timeout));
    return () => { active = false; clearTimeout(timeout); };
  }, [userId]);

  async function finish(outcome: TutorialOutcome) {
    await finishTutorial(userId, outcome);
    setStatus('done');
  }

  if (status === 'loading') return (
    <View style={[styles.loading, { backgroundColor: colors.background }]}>
      <ActivityIndicator accessibilityLabel="Loading your tutorial preference" color={colors.tint} />
    </View>
  );
  if (status === 'show') return <Tutorial onFinish={finish} onContinueWithoutSaving={() => setStatus('done')} />;
  return children;
}

const styles = StyleSheet.create({ loading: { flex: 1, alignItems: 'center', justifyContent: 'center' } });
