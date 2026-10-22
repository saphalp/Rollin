import { supabase } from '@/lib/supabase';

export async function loginEmailAction(action: 'send' | 'verify', challengeId?: string, code?: string) {
  const { data, error } = await supabase.functions.invoke('login-email', { body: { action, challengeId, code } });
  if (error) {
    let message = 'Could not connect to login verification. Please retry.';
    if (error.context instanceof Response) {
      const body = await error.context.json().catch(() => null);
      if (typeof body?.error === 'string') message = body.error;
    }
    throw new Error(message);
  }
  if (!data || data.error) throw new Error(data?.error ?? 'Could not verify this login.');
  return data as { verified?: boolean; sent?: boolean; challengeId?: string; retryAfter?: number; message?: string };
}
