export type CampusEvent = {
  id: string; campus: string; source_id: string; title: string;
  description: string | null; official_url: string; category: string | null;
  tags: string[]; location: string | null; room: string | null;
  image_url: string | null; status: string; synced_at: string;
  time_zone?: string; date_only: boolean; start_date: string | null; end_date: string | null;
  starts_at: string | null; ends_at: string | null;
};
const zone = 'America/Chicago';
export function campusDay(value: number | string, timeZone = zone): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(value));
  const part = (name: string) => parts.find(p => p.type === name)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}
export function campusUpcoming(event: CampusEvent, now: number): boolean {
  if (['CANCELLED', 'CANCELED'].includes(event.status.toUpperCase())) return false;
  return event.date_only ? !!event.end_date && event.end_date >= campusDay(now, event.time_zone ?? zone)
    : Date.parse(event.ends_at ?? '') > now;
}
export function campusDateLabel(event: CampusEvent): string {
  if (event.date_only) return `${event.start_date}${event.end_date !== event.start_date ? ` – ${event.end_date}` : ''} · All day`;
  const format = (value: string | null) => value ? new Date(value).toLocaleString('en-US', { timeZone: event.time_zone ?? zone, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';
  return `${format(event.starts_at)} – ${format(event.ends_at)} · ${event.time_zone ?? zone}`;
}
export function campusSortKey(event: CampusEvent): string {
  if (event.date_only) return `${event.start_date}T00:00:00`;
  return `${campusDay(event.starts_at ?? '', event.time_zone ?? zone)}T${new Date(event.starts_at ?? '').toLocaleTimeString('en-GB', { timeZone: event.time_zone ?? zone, hour12: false })}`;
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
