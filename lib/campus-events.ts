import { supabase } from '@/lib/supabase';

// Call again after login/logout and when returning to the event screen.
export async function canViewCampusEvents(): Promise<boolean> {
  const { data, error } = await supabase.rpc('can_view_latech_events');
  if (error) throw error;
  return data === true;
}

export async function loadCampusEvents(filters: {
  past?: boolean; search?: string; category?: string; location?: string;
} = {}) {
  let query = supabase.from(filters.past ? 'past_campus_events' : 'upcoming_campus_events')
    .select('*').eq('campus', 'latech');
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
  return rows.sort((a, b) => {
    const localKey = (event: any) => event.date_only ? event.start_date :
      new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Chicago', year: 'numeric',
        month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
        .format(new Date(event.starts_at));
    return localKey(a).localeCompare(localKey(b));
  });
}
