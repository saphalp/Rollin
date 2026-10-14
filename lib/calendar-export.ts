export type ExportScope = 'created' | 'joined' | 'created-joined' | 'all';
export type ExportPeriod = 'upcoming' | 'month' | 'all' | 'custom';
export type CalendarExportEvent = {
  id: string;
  host_id: string | null;
  title: string;
  date_time: string | null;
  description: string | null;
  location: string | null;
  formatted_address: string | null;
};
export type ExportBounds = { from?: number; until?: number };

export function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function localDay(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Choose a start and end date.');
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  if (dateKey(date) !== value) throw new Error('Choose valid calendar dates.');
  return date;
}

export function exportBounds(period: ExportPeriod, start: string, end: string, now = new Date()): ExportBounds {
  if (period === 'all') return {};
  if (period === 'upcoming') return { from: now.getTime() };
  if (period === 'month') return {
    from: new Date(now.getFullYear(), now.getMonth(), 1).getTime(),
    until: new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime(),
  };
  const from = localDay(start);
  const until = localDay(end);
  if (until < from) throw new Error('End date must be on or after start date.');
  // Calendar-day arithmetic preserves inclusive end dates across DST transitions.
  until.setDate(until.getDate() + 1);
  return { from: from.getTime(), until: until.getTime() };
}

export function selectExportEvents(events: CalendarExportEvent[], joinedIds: ReadonlySet<string>, userId: string, scope: ExportScope, bounds: ExportBounds) {
  const seen = new Set<string>();
  return events.filter(event => {
    const created = event.host_id === userId;
    const joined = joinedIds.has(event.id);
    if (scope === 'created' && !created || scope === 'joined' && !joined || scope === 'created-joined' && !created && !joined) return false;
    const start = event.date_time ? Date.parse(event.date_time) : NaN;
    if (!Number.isFinite(start) || bounds.from !== undefined && start < bounds.from || bounds.until !== undefined && start >= bounds.until || seen.has(event.id)) return false;
    seen.add(event.id);
    return true;
  }).sort((a, b) => Date.parse(a.date_time!) - Date.parse(b.date_time!) || a.id.localeCompare(b.id));
}

function escapeText(text: string): string {
  return text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');
}

// RFC 5545: fold at 75 UTF-8 octets without splitting a multi-byte character.
function foldLine(line: string): string {
  let result = '', bytes = 0;
  for (const char of line) {
    const point = char.codePointAt(0)!;
    const size = point < 0x80 ? 1 : point < 0x800 ? 2 : point < 0x10000 ? 3 : 4;
    if (bytes + size > 75) { result += '\r\n '; bytes = 1; }
    result += char;
    bytes += size;
  }
  return result;
}

const utcStamp = (date: Date) => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');

export function createCalendarFile(events: CalendarExportEvent[], now = new Date()): string {
  if (!events.length) throw new Error('No events match these filters.');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Rollin//Events//EN', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:Rollin events'];
  const seen = new Set<string>();
  for (const event of events) {
    if (seen.has(event.id)) continue;
    if (!event.date_time || !Number.isFinite(Date.parse(event.date_time))) throw new Error('An event is missing its start date. Refresh and try again.');
    seen.add(event.id);
    lines.push('BEGIN:VEVENT', `UID:${escapeText(event.id)}@rollin-app.org`, `DTSTAMP:${utcStamp(now)}`,
      `DTSTART:${utcStamp(new Date(event.date_time))}`, `SUMMARY:${escapeText(event.title)}`);
    if (event.description) lines.push(`DESCRIPTION:${escapeText(event.description)}`);
    const location = event.formatted_address?.trim() || event.location?.trim();
    if (location) lines.push(`LOCATION:${escapeText(location)}`);
    // Activities have no end-time field. RFC 5545 allows DTSTART without DTEND;
    // export the known start instead of inventing an event duration.
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join('\r\n') + '\r\n';
}
