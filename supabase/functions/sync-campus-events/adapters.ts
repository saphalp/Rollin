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
  && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
const instant = (value: unknown): string | null => {
  const text = str(value);
  if (!/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(text) || Number.isNaN(Date.parse(text))) return null;
  return new Date(text).toISOString();
};
function day(value: string, zone: string): string {
  const parts = new Intl.DateTimeFormat('en-US',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(value));
  const part = (name: string) => parts.find(p => p.type === name)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}
export function safeOfficialURL(value: unknown, hosts: string[]): string {
  const url = new URL(str(value));
  if (url.username || url.password || !hosts.includes(url.hostname.toLowerCase())
    || !['https:','http:'].includes(url.protocol) || (url.port && !['80','443'].includes(url.port))) throw new Error('Unexpected official event URL');
  url.protocol = 'https:'; url.port = '';
  return url.href;
}
function safeImage(value: unknown): string | null {
  try { const url = new URL(str(value)); return url.protocol==='https:' && !url.username && !url.password ? url.href : null; }
  catch { return null; }
}
export function modernCampusItem(item: any, source: SourceConfig, campus: UniversityConfig): EventRow {
  const sourceId = str(item['cal:guid']);
  const title = str(item.title), start = str(item['cal:start']), end = str(item['cal:end']);
  const dateOnly = validDay(start);
  const starts = instant(start), ends = instant(end);
  if (!sourceId || !title) throw new Error('Missing official ID or title');
  if (dateOnly ? !validDay(end) || end<start : !starts || !ends || ends<starts) throw new Error('Invalid date range');
  return {
    campus: campus.id, source_id: sourceId, source_config_id: source.id, title,
    description: optional(item.description), official_url: safeOfficialURL(item.link,campus.official_hosts),
    category: optional(item['cal:calendar']), tags: array(item['cal:tags']?.['cal:tag']).map(str).filter(Boolean),
    location: optional(item['cal:location']), room: optional(item['cal:locationRoom']), organizer: optional(item['cal:organizer']),
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
  if (end<start) throw new Error('Invalid date range');
  const allDay = truthy(item.is_all_day);
  const categories = array(item.event_types).map(str).filter(Boolean);
  const tags = [...categories,...array(item.tags).map(str),...array(item.tags_global).map(str)].filter(Boolean);
  return {
    campus:campus.id, source_id:`livewhale:${id}${item.repeats ? `:${start}` : ''}`, source_config_id:source.id, title,
    description:optional(item.description ?? item.summary), official_url:safeOfficialURL(item.url,campus.official_hosts),
    category:categories[0] ?? optional(item.group_title),tags:[...new Set(tags)], location:optional(item.location ?? item.location_title),
    room:null,organizer:optional(item.group_title),image_url:safeImage(item.thumbnail),
    status:truthy(item.is_canceled)?'CANCELLED':'CONFIRMED',featured:truthy(item.is_starred),time_zone:campus.time_zone,
    date_only:allDay,start_date:allDay?day(start,campus.time_zone):null,end_date:allDay?day(end,campus.time_zone):null,
    starts_at:allDay?null:start,ends_at:allDay?null:end,synced_at:new Date().toISOString(),
  };
}
export function uniqueRows(rows: EventRow[]): { rows: EventRow[]; duplicates: number } {
  const result = new Map<string, EventRow>(); let duplicates=0;
  for (const row of rows) { const key=`${row.campus}:${row.source_id}`; if(result.has(key)) duplicates++; result.set(key,row); }
  return {rows:[...result.values()],duplicates};
}
