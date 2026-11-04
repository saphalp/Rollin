import { createClient } from 'npm:@supabase/supabase-js@2';
import { XMLParser, XMLValidator } from 'npm:fast-xml-parser@4.5.3';

const reply = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
  status, headers: { 'Content-Type': 'application/json' },
});
const str = (value: unknown) => typeof value === 'string' ? value.trim() : '';

// Shared-domain provider: allow only its canonical RSS endpoint and an embedded
// official event-calendar URL that belongs to the SAME verified university.
function trustedModernCampusURL(value: string, officialHosts: string[]): string {
  const u = new URL(value);
  if (u.protocol !== 'https:' || u.hostname !== 'api.calendar.moderncampus.net'
    || u.username || u.password || (u.port && u.port !== '443') || u.hash
    || !/^\/pubcalendar\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/rss\/?$/i.test(u.pathname)
    || u.searchParams.get('hash') !== 'true' || u.searchParams.getAll('url').length !== 1
    || u.searchParams.size !== 2) throw new Error('Unsupported ModernCampus RSS URL');
  const inner = new URL(u.searchParams.get('url')!);
  if (inner.protocol !== 'https:' || !officialHosts.includes(inner.hostname.toLowerCase())
    || inner.username || inner.password || (inner.port && inner.port !== '443')) throw new Error('Calendar does not belong to this university');
  return u.href;
}
async function loadBoundedRSS(url: string): Promise<string> {
  const res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(20_000) });
  if (res.status >= 300 && res.status < 400) throw new Error('Feed redirect not permitted');
  if (!res.ok || !res.body) throw new Error(`Feed HTTP ${res.status}`);
  const reader = res.body.getReader(); const decoder = new TextDecoder();
  let size = 0, text = '';
  try {
    while (true) {
      const chunk = await reader.read(); if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > 5_000_000) throw new Error('Feed exceeds 5MB');
      text += decoder.decode(chunk.value, { stream: true });
    }
    return text + decoder.decode();
  } finally { await reader.cancel(); }
}
Deno.serve(async (req) => {
  if (req.method !== 'POST') return reply({ error: 'POST required' }, 405);
  const secret = Deno.env.get('CAMPUS_SYNC_SECRET');
  if (!secret || req.headers.get('x-campus-sync-secret') !== secret) return reply({ error: 'Unauthorized' }, 401);
  try {
    const body = await req.json();
    const id = str(body?.submission_id);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
      return reply({ error: 'Valid submission_id required' }, 400);
    const url = Deno.env.get('SUPABASE_URL'), key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key) throw new Error('Backend configuration missing');
    const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: submission, error: submissionError } = await db.from('campus_calendar_submissions')
      .select('id,university_id,calendar_url,status,reviewed_at').eq('id', id).single();
    if (submissionError) throw submissionError;
    if (submission.status !== 'approved' || !submission.reviewed_at)
      return reply({ error: 'Submission must be approved first' }, 409);
    const { data: campus, error: campusError } = await db.from('universities')
      .select('id,official_hosts,enabled').eq('id', submission.university_id).single();
    if (campusError) throw campusError;
    if (!campus.enabled) return reply({ error: 'University is disabled' }, 409);
    const permittedHosts = (campus.official_hosts as string[]).map(x => x.toLowerCase());
    const feed = trustedModernCampusURL(submission.calendar_url, permittedHosts);
    const xml = await loadBoundedRSS(feed);
    if (/<!DOCTYPE|<!ENTITY/i.test(xml) || XMLValidator.validate(xml) !== true) throw new Error('Invalid RSS XML');
    const channel = new XMLParser({ parseTagValue: false, trimValues: true }).parse(xml)?.rss?.channel;
    const title = str(channel?.title);
    const items = channel?.item ? (Array.isArray(channel.item) ? channel.item : [channel.item]) : [];
    if (!title || !items.length) throw new Error('Feed is empty or lacks a title');
    // Before registration verify actual event links point to university-owned hosts.
    let verified = 0;
    for (const item of items.slice(0, 30)) {
      if (!str(item?.['cal:guid']) || !str(item?.title)) continue;
      try {
        const event = new URL(str(item.link));
        if (event.protocol === 'https:' && permittedHosts.includes(event.hostname.toLowerCase())
          && !event.username && !event.password && (!event.port || event.port === '443')) verified++;
      } catch { /* ignore invalid event */ }
    }
    if (!verified) throw new Error('Feed has no events linked to this university');
    const { data: result, error: registerError } = await db.rpc('register_approved_campus_calendar', {
      p_submission_id: id, p_expected_feed_title: title,
    });
    if (registerError) throw registerError;
    return reply({ success: true, university_id: submission.university_id, feed_title: title, checked_events: verified, ...result });
  } catch (error) {
    console.error('[calendar-activate]', error);
    return reply({ error: error instanceof Error ? error.message : 'Activation failed' }, 400);
  }
});
