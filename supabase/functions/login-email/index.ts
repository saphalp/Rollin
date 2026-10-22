import { createClient } from 'npm:@supabase/supabase-js@2.110.2';
import { generateCode, hashCode } from './code.ts';
const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers });
const uuid = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  if (req.method !== 'POST') return reply({ error: 'Use POST.' }, 405);
  try {
    const authorization = req.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer ')) return reply({ error: 'Sign in again.' }, 401);
    const token = authorization.slice(7);
    const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authorization } }, auth: { persistSession: false, autoRefreshToken: false },
    });
    const [{ data: userData, error: userError }, { data: claimData, error: claimError }] = await Promise.all([
      client.auth.getUser(token), client.auth.getClaims(token),
    ]);
    const user = userData.user;
    const session = claimData?.claims.session_id;
    if (userError || claimError || !user?.email || !user.email_confirmed_at || typeof session !== 'string' || !uuid.test(session) || claimData?.claims.sub !== user.id) {
      return reply({ error: 'Sign in with a confirmed email address.' }, 401);
    }
    const body = await req.json().catch(() => null);
    if (!['send', 'verify'].includes(body?.action)) return reply({ error: 'Invalid action.' }, 400);
    const secret = Deno.env.get('LOGIN_CODE_SECRET');
    if (!secret || secret.length < 32) return reply({ error: 'Login verification is not configured. Contact the Rollin team.' }, 503);
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
    if (body.action === 'verify') {
      if (typeof body.code !== 'string' || !/^\d{6}$/.test(body.code) || typeof body.challengeId !== 'string' || !uuid.test(body.challengeId)) return reply({ error: 'Enter the six-digit code from your login email.' }, 400);
      const hash = await hashCode(secret, session, user.email, body.challengeId, body.code);
      const { data, error } = await admin.rpc('finish_login_email', { p_session: session, p_user: user.id, p_email: user.email, p_challenge: body.challengeId, p_hash: hash });
      if (error) return reply({ error: 'Could not verify the code. Try again.' }, 503);
      if (!data) return reply({ error: 'That code is invalid, expired, or used. After five incorrect tries, request a new code.' }, 400);
      return reply({ verified: true });
    }
    const apiKey = Deno.env.get('RESEND_API_KEY');
    const sender = Deno.env.get('LOGIN_EMAIL_FROM');
    if (!apiKey || !sender) return reply({ error: 'Login emails are not configured. Contact the Rollin team.' }, 503);
    const challengeId = crypto.randomUUID();
    const code = generateCode();
    const hash = await hashCode(secret, session, user.email, challengeId, code);
    const { data, error } = await admin.rpc('begin_login_email', { p_session: session, p_user: user.id, p_email: user.email, p_challenge: challengeId, p_hash: hash });
    if (error) return reply({ error: 'Could not request a code. Try again.' }, 503);
    if (data.error) return reply({ error: data.error }, 429);
    if (data.verified) return reply({ verified: true });
    if (!data.sent) return reply({ retryAfter: data.retryAfter, challengeId: data.challengeId, message: 'Please wait before requesting another code.' });
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': `login-${challengeId}` },
      body: JSON.stringify({ from: sender, to: [user.email], subject: 'Your Rollin login code', text: `Your Rollin login code is ${code}.\n\nEnter it in the app to finish signing in. It expires in 10 minutes and can only be used once.\n\nIf you did not try to sign in, change your password.` }),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) return reply({ error: 'Could not send your email. Wait a minute and try again.' }, 503);
    return reply({ sent: true, challengeId, retryAfter: 60 });
  } catch {
    // Never log tokens, email codes, or provider response bodies.
    return reply({ error: 'Could not complete verification. Check your connection and try again.' }, 503);
  }
});
