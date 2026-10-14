import { supabase } from '@/lib/supabase';
import type { CalendarExportEvent } from '@/lib/calendar-export';

const PAGE_SIZE = 500;

export async function loadCalendarExport(userId: string, signal: AbortSignal) {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || user?.id !== userId) throw new Error('Sign in again before exporting events.');

  async function activities() {
    const rows: CalendarExportEvent[] = [];
    for (let offset = 0; ;) {
      if (signal.aborted) throw new Error('Export closed.');
      const { data, error: failure } = await supabase.from('activities')
        .select('id, host_id, title, date_time, description, location, formatted_address')
        .order('id').range(offset, offset + PAGE_SIZE - 1).abortSignal(signal);
      if (failure) throw new Error('Could not load events. Please retry.');
      rows.push(...(data ?? []));
      if (!data?.length) return rows;
      offset += data.length;
    }
  }
  async function joined() {
    const ids = new Set<string>();
    for (let offset = 0; ;) {
      if (signal.aborted) throw new Error('Export closed.');
      const { data, error: failure } = await supabase.from('rsvps').select('activity_id')
        .eq('user_id', userId).order('activity_id').range(offset, offset + PAGE_SIZE - 1).abortSignal(signal);
      if (failure) throw new Error('Could not load joined events. Please retry.');
      for (const row of data ?? []) ids.add(row.activity_id);
      if (!data?.length) return ids;
      offset += data.length;
    }
  }
  const [events, joinedIds] = await Promise.all([activities(), joined()]);
  return { events, joinedIds };
}
