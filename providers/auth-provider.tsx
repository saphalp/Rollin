import { AuthContext } from '@/hooks/use-auth-context';
import { supabase } from '@/lib/supabase';
import { PropsWithChildren, useCallback, useEffect, useRef, useState } from 'react';

type Claims = Record<string, any>;
export default function AuthProvider({ children }: PropsWithChildren) {
  const [claims, setClaims] = useState<Claims | null | undefined>(undefined);
  const [profile, setProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [verified, setVerified] = useState(false);
  const [verificationError, setVerificationError] = useState('');
  const version = useRef(0);
  const alive = useRef(true);
  const approvedSession = useRef<{ id: unknown; user: unknown; email: unknown } | null>(null);
  const isLoggedIn = claims != null && verified;
  const needsEmailVerification = claims != null && !verified;
  const isProfileComplete = isLoggedIn && profile?.profile_completed === true;

  const refreshLoginVerification = useCallback(async () => {
    const request = ++version.current;
    const current = () => alive.current && request === version.current;
    try {
      const { data, error } = await supabase.auth.getClaims();
      if (error) throw error;
      if (!current()) return;
      const next = data?.claims ?? null;
      setClaims(next);
      const sameSession = next && approvedSession.current?.id === next.session_id
        && approvedSession.current?.user === next.sub && approvedSession.current?.email === next.email;
      if (!sameSession) {
        approvedSession.current = null;
        setProfile(null);
        setVerified(false);
      }
      setVerificationError('');
      if (!next) return;
      const { data: approved, error: verificationFailure } = await supabase.rpc('login_email_verified');
      if (!current()) return;
      if (verificationFailure) {
        approvedSession.current = null;
        setVerified(false); setProfile(null);
        setVerificationError('Could not check this login. Retry, or contact the Rollin team if verification has not been configured.');
        return;
      }
      if (approved !== true) {
        approvedSession.current = null;
        setVerified(false); setProfile(null);
        return;
      }
      const { data: row } = await supabase.from('profiles').select('*').eq('id', next.sub).single();
      if (!current()) return;
      setProfile(row);
      approvedSession.current = { id: next.session_id, user: next.sub, email: next.email };
      setVerified(true);
    } catch {
      if (current()) {
        approvedSession.current = null;
        setVerified(false); setProfile(null);
        setVerificationError('Could not check this login. Check your connection and retry.');
      }
    } finally {
      if (current()) setIsLoading(false);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!isLoggedIn || !claims?.sub) return;
    const request = version.current;
    const { data, error } = await supabase.from('profiles').select('*').eq('id', claims.sub).single();
    if (alive.current && request === version.current && !error) setProfile(data);
  }, [claims, isLoggedIn]);

  useEffect(() => {
    alive.current = true;
    // The initial server check intentionally updates loading/verification state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshLoginVerification();
    // Defer Auth calls until after the auth callback releases its lock.
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      ++version.current;
      // Rechecking the same session must not tear down navigation on token refresh
      // or profile/tutorial metadata updates. The server still enforces every request.
      if (event !== 'TOKEN_REFRESHED' && event !== 'USER_UPDATED') {
        setIsLoading(true);
        setVerified(false);
        setProfile(null);
      }
      if (!session) {
        approvedSession.current = null;
        setClaims(null); setIsLoading(false); return;
      }
      const timer = setTimeout(() => { timers.delete(timer); void refreshLoginVerification(); }, 0);
      timers.add(timer);
    });
    return () => {
      // Invalidate all outstanding requests, including those started after mount.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      alive.current = false; ++version.current;
      timers.forEach(clearTimeout);
      subscription.unsubscribe();
    };
  }, [refreshLoginVerification]);

  return <AuthContext.Provider value={{ claims, profile, isLoading, isLoggedIn, isProfileComplete, refreshProfile, needsEmailVerification, verificationError, refreshLoginVerification }}>{children}</AuthContext.Provider>;
}
