import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { getAccount, subscribeAccountChanges, type Account } from './account-center';
import { supabase } from '@/lib/supabase';
export function useAccountState() {
  const [account, setAccount] = useState<Account | null>(null);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState('');
  const generation = useRef(0);
  const reload = useCallback(async () => {
    const request = ++generation.current;
    setError('');
    try {
      const session = await supabase.auth.getSession();
      if (session.error) throw session.error;
      const next = session.data.session ? await getAccount() : null;
      if (request !== generation.current) return;
      if (session.data.session && !next) await supabase.auth.signOut({ scope: 'local' });
      if (request !== generation.current) return;
      setAccount(next);
    } catch (err) {
      if (request === generation.current) setError(err instanceof Error ? err.message : 'Unable to check account.');
    } finally { if (request === generation.current) setChecking(false); }
  }, []);
  useEffect(() => {
    let active = true; let identity: string | undefined;
    void reload();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const next = session?.user.id ?? '';
      if (next !== identity) { identity = next; ++generation.current; setAccount(null); setChecking(true); }
      setTimeout(() => { if (active) void reload(); }, 0);
    });
    const off = subscribeAccountChanges(() => { if (active) void reload(); });
    const foreground = AppState.addEventListener('change', state => { if (state === 'active') void reload(); });
    const timer = setInterval(() => { if (AppState.currentState === 'active') void reload(); }, 30_000);
    return () => { active = false; ++generation.current; subscription.unsubscribe(); off(); foreground.remove(); clearInterval(timer); };
  }, [reload]);
  return { account, checking, error, reload };
}
