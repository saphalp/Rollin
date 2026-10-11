import { supabase } from '@/lib/supabase';

export const TUTORIAL_METADATA_KEY = 'rollin_tutorial_v2';
export type TutorialOutcome = 'completed' | 'skipped';

async function currentUser(userId: string) {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user || data.user.id !== userId) throw new Error('Your account changed. Please try again.');
  return data.user;
}

export async function hasFinishedTutorial(userId: string): Promise<boolean> {
  const user = await currentUser(userId);
  const saved = user.user_metadata?.[TUTORIAL_METADATA_KEY];
  return saved?.outcome === 'completed' || saved?.outcome === 'skipped';
}

export async function finishTutorial(userId: string, outcome: TutorialOutcome): Promise<void> {
  await currentUser(userId);
  // User-editable onboarding preference only; never use this for authorization.
  const { error } = await supabase.auth.updateUser({
    data: { [TUTORIAL_METADATA_KEY]: { outcome, finished_at: new Date().toISOString() } },
  });
  if (error) throw error;
}
