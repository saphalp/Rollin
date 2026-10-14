export type MeetingParts = { day: string; hour: number; minute: number };
export function meetingParts(value: string): MeetingParts | null {
  const match = /^(\d{4}-\d{2}-\d{2}) (\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hour = Number(match[2]), minute = Number(match[3]);
  if (hour > 23 || minute > 59) return null;
  return { day: match[1], hour, minute };
}
export function formatMeeting(parts: MeetingParts): string {
  return `${parts.day} ${String(parts.hour).padStart(2,'0')}:${String(parts.minute).padStart(2,'0')}`;
}
export function timeLabel(parts: MeetingParts | null): string {
  return parts ? `${parts.hour % 12 || 12}:${String(parts.minute).padStart(2,'0')} ${parts.hour >= 12 ? 'PM' : 'AM'}` : 'Choose time';
}
export function hour24(hour12: number, period: 'AM' | 'PM'): number {
  return hour12 % 12 + (period === 'PM' ? 12 : 0);
}
// Surrogate picker dates represent wall-clock fields, not the actual event instant.
// Keep calendar selection at noon and time selection on a fixed non-transition day.
// The RPC, not the phone's time zone, converts the submitted wall-clock value.
export function calendarValue(parts: MeetingParts | null): Date {
  const [year,month,day] = (parts?.day ?? '2000-01-15').split('-').map(Number);
  return new Date(year,month-1,day,12,0,0,0);
}
export function clockValue(parts: MeetingParts | null): Date {
  return new Date(2000,0,15,parts?.hour ?? 12,parts?.minute ?? 0,0,0);
}
export function selectedDay(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
