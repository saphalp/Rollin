import { createClient } from 'npm:@supabase/supabase-js@2';
import { XMLParser, XMLValidator } from 'npm:fast-xml-parser@4.5.3';
import { array, liveWhaleItem, locationFromOfficialHTML, modernCampusItem, uniqueRows, type EventRow, type SourceConfig, type UniversityConfig } from './adapters.ts';

const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
function feedURL(value: string, source: SourceConfig): string {
  const u = new URL(value);
  if (u.protocol !== 'https:' || u.username || u.password || (u.port && u.port !== '443')
    || !source.allowed_feed_hosts.includes(u.hostname.toLowerCase())) throw new Error('Unapproved feed URL');
  return u.href;
}
async function fetchText(value: string, source: SourceConfig): Promise<string> {
  let url = feedURL(value, source);
  for (let redirects = 0; redirects < 4; redirects++) {
    const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(20_000) });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location'); if (!location) throw new Error('Missing redirect');
      url = feedURL(new URL(location, url).href, source); continue;
    }
    if (!response.ok) throw new Error(`Feed HTTP ${response.status}`);
    if (!response.body) throw new Error('Empty body');
    const reader = response.body.getReader(); const decoder = new TextDecoder(); let text = '', size = 0;
    try {
      while (true) {
        const chunk = await reader.read(); if (chunk.done) break; size += chunk.value.byteLength;
        if (size > 5_000_000) throw new Error('Feed exceeds size limit'); text += decoder.decode(chunk.value, { stream: true });
      }
      return text + decoder.decode();
    } finally { await reader.cancel(); }
  }
  throw new Error('Too many feed redirects');
}
async function importSource(source: SourceConfig, campus: UniversityConfig): Promise<{ rows: EventRow[]; duplicates: number; skipped: number }> {
  let raw: any[] = [];
  if (source.provider === 'moderncampus_rss') {
    const xml = await fetchText(source.feed_url, source);
    if (/<!DOCTYPE|<!ENTITY/i.test(xml) || XMLValidator.validate(xml) !== true) throw new Error('Invalid RSS XML');
    const document = new XMLParser({ parseTagValue: false, trimValues: true }).parse(xml);
    const channel = document?.rss?.channel;
    if (!channel || (source.expected_feed_title && channel.title !== source.expected_feed_title)) throw new Error('Unexpected feed');
    raw = array(channel.item);
  } else if (source.provider === 'livewhale_json') {
    let url: string | null = source.feed_url; const seen = new Set<string>(); let pages = 0;
    while (url) {
      if (seen.has(url) || ++pages > 20) throw new Error('Invalid/excessive feed pagination'); seen.add(url);
      const payload = JSON.parse(await fetchText(url, source));
      const items = Array.isArray(payload) ? payload : payload.data ?? payload.results;
      if (!Array.isArray(items)) throw new Error('Unexpected LiveWhale response');
      // v1's unpaginated limit is 1000; refuse a potentially truncated import.
      if (Array.isArray(payload) && items.length >= 1000) throw new Error('LiveWhale feed reached 1000; configure pagination/date windows');
      raw.push(...items);
      url = Array.isArray(payload) ? null : payload.links?.next ?? null;
      if (raw.length > 10_000) throw new Error('Too many events');
    }
  } else throw new Error('Unsupported provider');
  if (!raw.length) throw new Error('Empty feed; existing records retained');
  const rows: EventRow[] = []; let skipped = 0;
  for (const item of raw) {
    try { rows.push(source.provider === 'moderncampus_rss' ? modernCampusItem(item, source, campus) : liveWhaleItem(item, source, campus)); }
    catch (error) { skipped++; console.warn(`Source ${source.id} skipped an invalid event:`, error instanceof Error ? error.message : 'Invalid event'); }
  }
  if (!rows.length) throw new Error('No valid events; existing records retained');
  return { ...uniqueRows(rows), skipped };
}
// Read a bounded official event page. Validate every redirect against the
// university's allowlist to avoid accessing an unexpected server.
async function fetchOfficialEventHTML(link: string, campus: UniversityConfig): Promise<string | null> {
  try {
    let url = new URL(link);
    for (let redirect = 0; redirect < 3; redirect++) {
      if (url.protocol !== 'https:' || url.username || url.password || url.port ||
        !campus.official_hosts.includes(url.hostname.toLowerCase())) return null;
      const res = await fetch(url.href, { redirect: 'manual', signal: AbortSignal.timeout(7_000) });
      if ([301, 302, 303, 307, 308].includes(res.status)) {
        const next = res.headers.get('location');
        if (!next) return null;
        url = new URL(next, url);
        continue;
      }
      if (!res.ok || !(res.headers.get('content-type') ?? '').toLowerCase().includes('text/html') || !res.body) return null;
      const reader = res.body.getReader(); const decoder = new TextDecoder(); let html = ''; let size = 0;
      try {
        while (true) {
          const part = await reader.read(); if (part.done) break;
          size += part.value.byteLength; if (size > 800_000) return null;
          html += decoder.decode(part.value, { stream: true });
        }
        return html + decoder.decode();
      } finally { await reader.cancel(); }
    }
  } catch { /* One unavailable event page must never fail the whole sync. */ }
  return null;
}

async function excludeOtherSourceEvents(db: any, rows: EventRow[], campus: UniversityConfig, source: SourceConfig) {
  const blocked = new Set<string>();
  const ids = [...new Set(rows.map(row => row.source_id))];
  for (let offset = 0; offset < ids.length; offset += 200) {
    const { data, error } = await db.from('campus_events')
      .select('source_id,source_config_id')
      .eq('campus', campus.id)
      .in('source_id', ids.slice(offset, offset + 200));
    if (error) throw error;
    for (const existing of data ?? []) {
      if (existing.source_config_id != null && existing.source_config_id !== source.id) {
        blocked.add(existing.source_id);
      }
    }
  }
  return { rows: rows.filter(row => !blocked.has(row.source_id)), cross_source_duplicates: blocked.size };
}

// Preserve previously recovered venues, then examine future events missing a location.
// Sort by start time so near-term events get enriched first; bound fetches per run.
async function enrichLocations(db: any, rows: EventRow[], campus: UniversityConfig) {
  let recovered = 0; let checked = 0;
  const sourceIds = rows.map(r => r.source_id);
  for (let start = 0; start < sourceIds.length; start += 200) {
    const { data, error } = await db.from('campus_events')
      .select('source_id,location,room').eq('campus', campus.id).in('source_id', sourceIds.slice(start, start + 200));
    if (error) throw error;
    const stored = new Map<string, { location: string | null; room: string | null }>(
      (data ?? []).map((r: any) => [r.source_id, { location: r.location, room: r.room }]));
    for (const row of rows.slice(start, start + 200)) {
      const previous = stored.get(row.source_id);
      row.location ||= previous?.location ?? null;
      row.room ||= previous?.room ?? null;
    }
  }
  const now = Date.now();
  const missing = rows.filter(r => !r.location &&
    (r.ends_at ? Date.parse(r.ends_at) >= now : (r.end_date ?? '') >= new Date(now).toISOString().slice(0, 10)))
    .sort((a, b) => (a.starts_at ?? a.start_date ?? '').localeCompare(b.starts_at ?? b.start_date ?? ''));
  // Keep the per-source workload bounded, but avoid making 20 requests sequentially.
  const queue = missing.slice(0, 30);
  for (let start = 0; start < queue.length; start += 4) {
    const batch = queue.slice(start, start + 4);
    await Promise.all(batch.map(async row => {
      checked++;
      const html = await fetchOfficialEventHTML(row.official_url, campus);
      if (!html) return;
      const loc = locationFromOfficialHTML(html);
      if (loc.location) { row.location = loc.location; row.room ||= loc.room; recovered++; }
    }));
  }
  return { locations_checked: checked, locations_recovered: recovered, locations_remaining: Math.max(0, missing.length - recovered) };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return respond({ error: 'POST required' }, 405);
  const secret = Deno.env.get('CAMPUS_SYNC_SECRET');
  if (!secret) return respond({ error: 'Sync secret is not configured' }, 500);
  if (req.headers.get('x-campus-sync-secret') !== secret) return respond({ error: 'Unauthorized' }, 401);
  try {
    const url = Deno.env.get('SUPABASE_URL'), key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key) throw new Error('Missing backend configuration');
    const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const [sourceResult, campusResult] = await Promise.all([
      db.from('university_event_sources').select('*').eq('enabled', true),
      db.from('universities').select('id,time_zone,official_hosts').eq('enabled', true),
    ]);
    if (sourceResult.error) throw sourceResult.error; if (campusResult.error) throw campusResult.error;
    const results: any[] = [];
    // Newly activated submission-backed sources must remain approved.
    // Older built-in LA Tech/ULM sources have no submission_id and remain supported.
    const sources = (sourceResult.data ?? []) as (SourceConfig & { submission_id?: string | null })[];
    const linkedIds = [...new Set(sources.map(s => s.submission_id).filter((id): id is string => !!id))];
    const approved = new Map<string, { university_id: string; calendar_url: string; status: string }>();
    if (linkedIds.length) {
      const { data: verified, error: verificationError } = await db
        .from('campus_calendar_submissions')
        .select('id,university_id,calendar_url,status').in('id', linkedIds);
      if (verificationError) throw verificationError;
      for (const row of verified ?? []) approved.set(row.id, row);
    }
    for (const source of sources) {
      if (source.submission_id) {
        const submission = approved.get(source.submission_id);
        if (!submission || submission.status !== 'approved' || submission.university_id !== source.university_id || submission.calendar_url !== source.feed_url) {
          results.push({ source: source.id, campus: source.university_id, success: false, error: 'Source submission is not currently approved or no longer matches the registered URL' });
          continue;
        }
      }
      const campus = (campusResult.data as UniversityConfig[]).find(u => u.id === source.university_id); if (!campus) continue;
      try {
        const result = await importSource(source, campus);
        const deduped = await excludeOtherSourceEvents(db, result.rows, campus, source);
        const locationStats = deduped.rows.length ? await enrichLocations(db, deduped.rows, campus)
          : { locations_checked: 0, locations_recovered: 0, locations_remaining: 0 };
        if (deduped.rows.length) {
          const { error } = await db.from('campus_events').upsert(deduped.rows, { onConflict: 'campus,source_id' });
          if (error) throw error;
        }
        const health = await db.from('university_event_sources').update({ last_synced_at: new Date().toISOString(), last_error: null }).eq('id', source.id);
        if (health.error) throw health.error;
        results.push({ source: source.id, campus: campus.id, success: true, imported: deduped.rows.length, duplicates: result.duplicates, cross_source_duplicates: deduped.cross_source_duplicates, skipped: result.skipped, ...locationStats });
      } catch (error) {
        const message = error instanceof Error ? error.message : String((error as any)?.message ?? 'Sync failed');
        console.error(`Source ${source.id} failed:`, message);
        await db.from('university_event_sources').update({ last_error: message }).eq('id', source.id);
        results.push({ source: source.id, campus: campus.id, success: false, error: message });
      }
    }
    if (!results.length) throw new Error('No enabled sources');
    return respond({ success: results.every(r => r.success), results }, results.every(r => r.success) ? 200 : 207);
  } catch (error) {
    console.error('Campus sync failed:', error);
    return respond({ error: 'Sync failed; inspect function logs. Existing events retained.' }, 500);
  }
});
