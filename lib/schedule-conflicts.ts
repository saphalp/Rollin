export const CONFLICT_WINDOW_MINUTES = 60;
export const CONFLICT_WINDOW_MS = CONFLICT_WINDOW_MINUTES * 60 * 1000;

export type ScheduledActivity = {
  id: string;
  title: string;
  date_time: string | null;
  host_id: string | null;
  status: string | null;
};
export type ScheduleWarning = { target: ScheduledActivity; conflicts: ScheduledActivity[] };

export function findScheduleConflicts(target: ScheduledActivity, commitments: ScheduledActivity[]): ScheduledActivity[] {
  const start = target.date_time ? Date.parse(target.date_time) : NaN;
  if (!Number.isFinite(start)) throw new Error('This activity needs a valid start time before you can join.');
  const seen = new Set<string>();
  return commitments.filter(activity => {
    if (activity.id === target.id || seen.has(activity.id) || ['cancelled', 'canceled'].includes(activity.status?.toLowerCase() ?? '')) return false;
    const otherStart = activity.date_time ? Date.parse(activity.date_time) : NaN;
    if (!Number.isFinite(otherStart) || Math.abs(otherStart - start) > CONFLICT_WINDOW_MS) return false;
    seen.add(activity.id);
    return true;
  }).sort((a, b) => Date.parse(a.date_time!) - Date.parse(b.date_time!) || a.id.localeCompare(b.id));
}

export function scheduleTimeLabel(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
  });
}
