import { supabase } from '@/lib/supabase';
import { CONFLICT_WINDOW_MS, findScheduleConflicts, type ScheduledActivity, type ScheduleWarning } from '@/lib/schedule-conflicts';

const FIELDS = 'id, title, date_time, host_id, status';
const PAGE_SIZE = 100;
type Page<T> = PromiseLike<{ data: T[] | null; error: unknown }>;

async function readPages<T>(query: (from: number, to: number) => Page<T>, signal: AbortSignal) {
  const rows: T[] = [];
  for (let offset = 0; ;) {
    if (signal.aborted) throw new Error('Schedule check canceled.');
    const { data, error } = await query(offset, offset + PAGE_SIZE - 1);
    if (signal.aborted) throw new Error('Schedule check canceled.');
    if (error) throw new Error('Could not check your schedule. Please try joining again.');
    if (!data?.length) return rows;
    rows.push(...data);
    offset += data.length;
  }
}

export async function checkScheduleConflicts(activityId: string, userId: string, signal: AbortSignal): Promise<ScheduleWarning> {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (signal.aborted) throw new Error('Schedule check canceled.');
  if (authError || user?.id !== userId) throw new Error('Sign in again before joining this activity.');
  // Read the current start time rather than the potentially stale detail screen.
  const { data: target, error } = await supabase.from('activities').select(FIELDS)
    .eq('id', activityId).abortSignal(signal).maybeSingle();
  if (error || !target) throw new Error('Could not load this activity. Refresh it and try again.');
  if (['cancelled', 'canceled'].includes(target.status?.toLowerCase() ?? '')) throw new Error('This activity has been canceled.');
  const start = target.date_time ? Date.parse(target.date_time) : NaN;
  if (!Number.isFinite(start)) throw new Error('This activity needs a valid start time before you can join.');
  const from = new Date(start - CONFLICT_WINDOW_MS).toISOString();
  const through = new Date(start + CONFLICT_WINDOW_MS).toISOString();

  const [hosted, joined] = await Promise.all([
    readPages<ScheduledActivity>((first, last) => supabase.from('activities').select(FIELDS)
      .eq('host_id', userId).gte('date_time', from).lte('date_time', through)
      .order('id').range(first, last).abortSignal(signal), signal),
    readPages<{ activity: ScheduledActivity | ScheduledActivity[] }>((first, last) => supabase.from('rsvps')
      .select(`id, activity:activities!inner(${FIELDS})`).eq('user_id', userId)
      .gte('activity.date_time', from).lte('activity.date_time', through)
      .order('id').range(first, last).abortSignal(signal), signal),
  ]);
  return { target, conflicts: findScheduleConflicts(target, [...hosted, ...joined.flatMap(row => row.activity ?? [])]) };
}
