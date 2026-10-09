import { supabase } from '@/lib/supabase';
import { getCurrentUniversity } from '@/lib/university';
import { campusSortKey, type CampusEvent } from '@/lib/home-campus-events';
import { isAcademicCalendar } from '@/lib/home-feed';

// Call again after login/logout and when returning to the event screen.
export async function canViewCampusEvents(): Promise<boolean> {
  return !!(await getCurrentUniversity())?.calendar_enabled;
}

export async function loadCampusEvents(filters: {
  past?: boolean; search?: string; category?: string; location?: string;
} = {}) {
  const university = await getCurrentUniversity();
  if (!university?.calendar_enabled) return [];
  let query = supabase.from(filters.past ? 'past_campus_events' : 'upcoming_campus_events')
    .select('*').eq('campus', university.id);
  if (filters.category) query = query.eq('category', filters.category);
  const literal = (value: string) => value.replace(/[\\%_]/g, '\\$&');
  if (filters.search?.trim()) query = query.ilike('title', `%${literal(filters.search.trim())}%`);
  if (filters.location?.trim()) query = query.ilike('location', `%${literal(filters.location.trim())}%`);
  // Return the complete current feed-backed set, not a silent 1000-row truncation.
  const rows: any[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await query.order('id').range(offset, offset + 499);
    if (error) throw error;
    rows.push(...(data ?? []));
    if ((data?.length ?? 0) < 500) break;
  }
  return rows.filter(event => !isAcademicCalendar(event)).sort((a: CampusEvent, b: CampusEvent) => campusSortKey(a).localeCompare(campusSortKey(b)));
}
