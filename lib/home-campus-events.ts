export type CampusEvent = {
  id: string; campus: string; source_id: string; title: string;
  description: string | null; official_url: string; category: string | null;
  tags: string[]; location: string | null; room: string | null;
  image_url: string | null; status: string; synced_at: string;
  time_zone?: string; date_only: boolean; start_date: string | null; end_date: string | null;
  starts_at: string | null; ends_at: string | null;
};
const zone = 'America/Chicago';
const INVALID_SORT_KEY = '9999-12-31T23:59:59';

function validInstant(value: string | null | undefined): Date | null {
  if (!value?.trim()) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function validCalendarDate(value: string | null | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function safeTimeZone(value: string | undefined): string {
  if (!value) return zone;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return value;
  } catch {
    return zone;
  }
}

export function campusDay(value: number | string, timeZone = zone): string {
  const date = typeof value === 'number' ? new Date(value) : validInstant(value);
  if (!date || !Number.isFinite(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: safeTimeZone(timeZone), year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const part = (name: string) => parts.find(p => p.type === name)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function campusUpcoming(event: CampusEvent, now: number): boolean {
  if (['CANCELLED', 'CANCELED'].includes(event.status.toUpperCase())) return false;
  if (event.date_only) {
    const today = campusDay(now, event.time_zone ?? zone);
    return validCalendarDate(event.end_date) && !!today && event.end_date >= today;
  }
  const end = validInstant(event.ends_at);
  return !!end && end.getTime() > now;
}

export function campusDateLabel(event: CampusEvent): string {
  if (event.date_only) {
    if (!validCalendarDate(event.start_date)) return 'Date unavailable';
    const end = validCalendarDate(event.end_date) ? event.end_date : event.start_date;
    return `${event.start_date}${end !== event.start_date ? ` – ${end}` : ''} · All day`;
  }
  const timeZone = safeTimeZone(event.time_zone);
  const format = (value: string | null) => {
    const date = validInstant(value);
    return date ? date.toLocaleString('en-US', {
      timeZone, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    }) : '';
  };
  const start = format(event.starts_at);
  const end = format(event.ends_at);
  if (!start) return 'Date unavailable';
  return `${start}${end ? ` – ${end}` : ''} · ${event.time_zone && timeZone === event.time_zone ? event.time_zone : timeZone}`;
}

export function campusSortKey(event: CampusEvent): string {
  if (event.date_only) return validCalendarDate(event.start_date) ? `${event.start_date}T00:00:00` : INVALID_SORT_KEY;
  const date = validInstant(event.starts_at);
  if (!date) return INVALID_SORT_KEY;
  const timeZone = safeTimeZone(event.time_zone);
  return `${campusDay(date.getTime(), timeZone)}T${date.toLocaleTimeString('en-GB', { timeZone, hour12: false })}`;
}

export function uniqueCampusEvents(events: CampusEvent[]): CampusEvent[] {
  const unique = new Map<string, CampusEvent>();
  for (const event of events) {
    const key = `${event.campus}:${event.source_id}`;
    const previous = unique.get(key);
    if (!previous || event.synced_at > previous.synced_at) unique.set(key, event);
  }
  return [...unique.values()];
}
export function plainDescription(value: string): string {
  return value.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();
}
