export type UniversityConfig = { id: string; time_zone: string; official_hosts: string[] };
export type SourceConfig = {
  id: string; university_id: string; provider: string; feed_url: string;
  allowed_feed_hosts: string[]; expected_feed_title: string | null;
};
export type EventRow = {
  campus: string; source_id: string; source_config_id: string; title: string;
  description: string | null; official_url: string; category: string | null; tags: string[];
  location: string | null; room: string | null; organizer: string | null; image_url: string | null;
  status: string; featured: boolean; time_zone: string; date_only: boolean;
  start_date: string | null; end_date: string | null; starts_at: string | null; ends_at: string | null; synced_at: string;
};
export const str = (value: unknown): string => typeof value === 'string' ? value.trim()
  : typeof value === 'number' ? String(value) : '';
const optional = (value: unknown) => str(value) || null;
export const array = (value: any): any[] => value == null ? [] : Array.isArray(value) ? value : [value];
const truthy = (value: unknown) => value === true || value === 1 || value === '1' || value === 'true';
const validDay = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value)
  && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
const instant = (value: unknown): string | null => {
  const text = str(value);
  if (!/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(text) || Number.isNaN(Date.parse(text))) return null;
  return new Date(text).toISOString();
};
function day(value: string, zone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(value));
  const part = (name: string) => parts.find(p => p.type === name)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}
export function safeOfficialURL(value: unknown, hosts: string[]): string {
  const url = new URL(str(value));
  if (url.username || url.password || !hosts.includes(url.hostname.toLowerCase())
    || !['https:', 'http:'].includes(url.protocol) || (url.port && !['80', '443'].includes(url.port))) throw new Error('Unexpected official event URL');
  url.protocol = 'https:'; url.port = '';
  return url.href;
}
function safeImage(value: unknown): string | null {
  try { const url = new URL(str(value)); return url.protocol === 'https:' && !url.username && !url.password ? url.href : null; }
  catch { return null; }
}
// Read alternate location fields only when the canonical calendar fields are empty.
// This does not invent venue information absent from the source.
const firstValue = (...values: unknown[]): string | null => {
  for (const value of values) {
    if (typeof value === 'object' && value !== null) {
      const nested = firstValue((value as any)['#text'], (value as any).name, (value as any).title);
      if (nested) return nested;
    } else if (optional(value)) return optional(value);
  }
  return null;
};

// Extract a location from trusted event-specific metadata or a clearly labeled venue field.
// Avoid page-wide address guesses: footer/contact addresses are not event venues.
const decodeText = (html: string): string => html
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]*>/g, ' ')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
  .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
  .replace(/&#(\d+);/g, (_match, n: string) => String.fromCodePoint(Number(n)))
  .replace(/\s+/g, ' ').trim();

function venue(value: unknown): string | null {
  const text = decodeText(str(value));
  if (!text || text.length > 250 || /^(?:online|virtual|tbd|to be determined|n\/a|none)$/i.test(text)) return null;
  if (/https?:\/\/|<|>|\b(?:learn more|add to my calendar)\b/i.test(text)) return null;
  return text;
}

export function locationFromOfficialHTML(html: string): { location: string | null; room: string | null } {
  const blocks = [...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  const findEvent = (node: any): any => {
    if (!node || typeof node !== 'object') return null;
    if (Array.isArray(node)) { for (const item of node) { const hit = findEvent(item); if (hit) return hit; } return null; }
    if (array(node['@type']).some(type => /^event$|event$/i.test(str(type))) && node.location) return node;
    for (const key of ['@graph', 'mainEntity', 'itemListElement']) {
      if (node[key]) { const hit = findEvent(node[key]); if (hit) return hit; }
    }
    return null;
  };
  for (const block of blocks) {
    try {
      const event = findEvent(JSON.parse(block[1]));
      if (!event) continue;
      const place = Array.isArray(event.location) ? event.location[0] : event.location;
      const found = venue(typeof place === 'string' ? place : firstValue(place?.name, place?.address?.streetAddress));
      if (found) return { location: found, room: null };
    } catch { /* Invalid metadata is ignored. */ }
  }

  // Structured HTML event venue: <span itemprop="location">...</span> or
  // elements with event-specific class names such as event-location.
  const structured = [
    /<([a-z][\w-]*)\b(?=[^>]*\bitemprop=["']location["'])[^>]*>([\s\S]*?)<\/\1>/i,
    /<([a-z][\w-]*)\b(?=[^>]*\bclass=["'][^"']*(?:event[-_ ]location|event[-_ ]venue|location[-_ ]name|venue[-_ ]name)[^"']*["'])[^>]*>([\s\S]*?)<\/\1>/i,
  ];
  for (const pattern of structured) {
    const match = html.match(pattern);
    const found = match ? venue(match[2]) : null;
    if (found) return { location: found, room: null };
  }

  // University event detail cards often have a date row followed by a location row.
  // Match only short labeled fields, not arbitrary 'Location' mentions in the article.
  const labeled = [
    /<dt\b[^>]*>\s*(?:<[^>]+>)*\s*(?:Location|Venue)\s*(?:<\/[^>]+>)*\s*<\/dt>\s*<dd\b[^>]*>([\s\S]*?)<\/dd>/i,
    /<(?:strong|b|label)\b[^>]*>\s*(?:Location|Venue)\s*:?\s*<\/(?:strong|b|label)>\s*(?:<[^>]+>)*\s*([^<]{3,180})/i,
  ];
  for (const pattern of labeled) {
    const match = html.match(pattern);
    const found = match ? venue(match[1]) : null;
    if (found) return { location: found, room: null };
  }
  return { location: null, room: null };
}

export function modernCampusItem(item: any, source: SourceConfig, campus: UniversityConfig): EventRow {
  const sourceId = str(item['cal:guid']);
  const title = str(item.title), start = str(item['cal:start']), end = str(item['cal:end']);
  const dateOnly = validDay(start);
  const starts = instant(start), ends = instant(end);
  if (!sourceId || !title) throw new Error('Missing official ID or title');
  if (dateOnly ? !validDay(end) || end < start : !starts || !ends || ends < starts) throw new Error('Invalid date range');
  return {
    campus: campus.id, source_id: sourceId, source_config_id: source.id, title,
    description: optional(item.description), official_url: safeOfficialURL(item.link, campus.official_hosts),
    category: optional(item['cal:calendar']), tags: array(item['cal:tags']?.['cal:tag']).map(str).filter(Boolean),
    location: firstValue(item['cal:location'], item['cal:venue'], item.location), room: firstValue(item['cal:locationRoom'], item['cal:room'], item.room), organizer: optional(item['cal:organizer']),
    image_url: safeImage(item['cal:image']), status: str(item['cal:status']) || 'CONFIRMED', featured: truthy(item['cal:featured']),
    time_zone: campus.time_zone, date_only: dateOnly, start_date: dateOnly ? start : null, end_date: dateOnly ? end : null,
    starts_at: dateOnly ? null : starts, ends_at: dateOnly ? null : ends, synced_at: new Date().toISOString(),
  };
}
export function liveWhaleItem(item: any, source: SourceConfig, campus: UniversityConfig): EventRow {
  const id = str(item.id), title = str(item.title);
  const start = instant(item.date_iso), suppliedEnd = instant(item.date2_iso);
  if (!id || !title || !start) throw new Error('Missing event ID/title/start');
  if (item.date2_iso && !suppliedEnd) throw new Error('Invalid end date');
  const end = suppliedEnd ?? start;
  if (end < start) throw new Error('Invalid date range');
  const allDay = truthy(item.is_all_day);
  const categories = array(item.event_types).map(str).filter(Boolean);
  const tags = [...categories, ...array(item.tags).map(str), ...array(item.tags_global).map(str)].filter(Boolean);
  return {
    campus: campus.id, source_id: `livewhale:${id}${item.repeats ? `:${start}` : ''}`, source_config_id: source.id, title,
    description: optional(item.description ?? item.summary), official_url: safeOfficialURL(item.url, campus.official_hosts),
    category: categories[0] ?? optional(item.group_title), tags: [...new Set(tags)], location: firstValue(item.location, item.location_title, item.venue?.name),
    room: firstValue(item.room, item.room_number), organizer: optional(item.group_title), image_url: safeImage(item.thumbnail),
    status: truthy(item.is_canceled) ? 'CANCELLED' : 'CONFIRMED', featured: truthy(item.is_starred), time_zone: campus.time_zone,
    date_only: allDay, start_date: allDay ? day(start, campus.time_zone) : null, end_date: allDay ? day(end, campus.time_zone) : null,
    starts_at: allDay ? null : start, ends_at: allDay ? null : end, synced_at: new Date().toISOString(),
  };
}
export function uniqueRows(rows: EventRow[]): { rows: EventRow[]; duplicates: number } {
  const result = new Map<string, EventRow>(); let duplicates = 0;
  for (const row of rows) { const key = `${row.campus}:${row.source_id}`; if (result.has(key)) duplicates++; result.set(key, row); }
  return { rows: [...result.values()], duplicates };
}
