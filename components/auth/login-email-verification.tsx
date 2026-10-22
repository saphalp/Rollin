import { useCallback, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Text, TextInput } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuthContext } from '@/hooks/use-auth-context';
import { loginEmailAction } from '@/lib/login-email';
import { supabase } from '@/lib/supabase';

// Paper ignores textColor/buttonColor when disabled, so override those theme colors.
const loginButtonTheme = {
  colors: { onSurfaceDisabled: '#345277', surfaceDisabled: '#E2ECFA' },
};

export function LoginEmailVerification() {
  const colors = Colors[useColorScheme() ?? 'light'];
  const { claims, verificationError, refreshLoginVerification } = useAuthContext();
  const [code, setCode] = useState('');
  const [challenge, setChallenge] = useState<string>();
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const busyRef = useRef(false);
  const deadline = useRef(0);
  const alive = useRef(true);

  const send = useCallback(async () => {
    if (busyRef.current || Date.now() < deadline.current) return;
    busyRef.current = true; setBusy(true); setError('');
    try {
      const data = await loginEmailAction('send');
      if (!alive.current) return;
      if (data.verified) { await refreshLoginVerification(); return; }
      if (data.challengeId) setChallenge(data.challengeId);
      const wait = data.retryAfter ?? 60;
      deadline.current = Date.now() + wait * 1000;
      setSeconds(wait);
      setMessage(data.sent ? 'Code sent. Check your inbox and spam folder.' : data.message ?? 'Check your latest login email.');
    } catch (e) {
      if (alive.current) setError(e instanceof Error ? e.message : 'Could not send a code.');
    } finally { busyRef.current = false; if (alive.current) setBusy(false); }
  }, [refreshLoginVerification]);

  useEffect(() => {
    alive.current = true;
    const timer = setInterval(() => setSeconds(Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000))), 1000);
    return () => { alive.current = false; clearInterval(timer); };
  }, []);

  useEffect(() => {
    // Start the external email request when a pending login reaches this screen.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!verificationError) void send();
  }, [send, verificationError]);

  async function verify() {
    if (busyRef.current) return;
    if (!/^\d{6}$/.test(code) || !challenge) { setError('Request a code, then enter its six digits.'); return; }
    busyRef.current = true; setBusy(true); setError('');
    try {
      await loginEmailAction('verify', challenge, code);
      await refreshLoginVerification();
    } catch (e) { if (alive.current) setError(e instanceof Error ? e.message : 'Could not verify the code.'); }
    finally { busyRef.current = false; if (alive.current) setBusy(false); }
  }
  async function cancel() {
    if (busyRef.current) return;
    const { error: failure } = await supabase.auth.signOut({ scope: 'local' });
    if (failure) setError('Could not sign out. Please try again.');
  }
  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={[styles.card, { backgroundColor: colors.cardBackground }]}>
            <Text style={[styles.title, { color: colors.text }]}>Verify your login</Text>
            <Text style={{ color: colors.icon }}>Enter the login code emailed to {typeof claims?.email === 'string' ? claims.email : 'your account email'}.</Text>
            <Text style={{ color: colors.icon }}>The code expires in 10 minutes.</Text>
            {verificationError ? <>
              <Text accessibilityRole="alert" style={{ color: colors.error }}>{verificationError}</Text>
              <Button textColor={colors.tint} onPress={refreshLoginVerification} disabled={busy}>Retry connection</Button>
            </> : null}
            {challenge && <>
              <TextInput label="Login code" value={code} onChangeText={value => setCode(value.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" autoComplete="one-time-code" textContentType="oneTimeCode" mode="outlined" activeOutlineColor={colors.tint} textColor={colors.text} style={{ backgroundColor: colors.cardBackground }} />
              <Button
                mode="contained"
                buttonColor={colors.tint}
                textColor={colors.onPrimary}
                theme={loginButtonTheme}
                disabled={busy || code.length !== 6}
                loading={busy}
                onPress={verify}
              >Verify code</Button>
            </>}
            {!!error && <Text accessibilityRole="alert" style={{ color: colors.error }}>{error}</Text>}
            {!!message && <Text accessibilityLiveRegion="polite" style={{ color: colors.icon }}>{message}</Text>}
            <Button
              mode={challenge ? 'outlined' : 'contained'}
              buttonColor={challenge ? undefined : colors.tint}
              textColor={challenge ? colors.tint : colors.onPrimary}
              theme={loginButtonTheme}
              style={busy || seconds > 0 ? styles.disabledResend : undefined}
              disabled={busy || seconds > 0}
              onPress={send}
            >{seconds > 0 ? `Resend in ${seconds}s` : challenge ? 'Resend code' : 'Send login code'}</Button>
            <Button textColor={colors.tint} disabled={busy} onPress={cancel}>Back to login</Button>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({ root: { flex: 1 }, content: { flexGrow: 1, justifyContent: 'center', padding: 24 }, card: { padding: 24, borderRadius: 20, gap: 18 }, title: { fontSize: 26, fontWeight: '700' }, disabledResend: { backgroundColor: '#E2ECFA', borderColor: '#9EB5D4' } });
