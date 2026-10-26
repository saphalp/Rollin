import { supabase } from '@/lib/supabase';
import { buildCalendarPlans, type CalendarActivity, type CalendarRide } from '@/lib/calendar-plans';

const PAGE_SIZE = 500;
const RIDE_FIELDS = 'id, driver_id, date_time, status, pickup_location, destination';
const ACTIVE_RIDE_STATUSES = ['open', 'full', 'in_progress'];
type Page<T> = PromiseLike<{ data: T[] | null; error: unknown }>;

async function allPages<T>(query: (from: number, to: number) => Page<T>, signal: AbortSignal): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ;) {
    if (signal.aborted) throw new Error('Calendar refresh canceled.');
    const { data, error } = await query(offset, offset + PAGE_SIZE - 1);
    if (signal.aborted) throw new Error('Calendar refresh canceled.');
    if (error) throw new Error('Could not refresh your calendar. Check your connection and try again.');
    if (!data?.length) return rows;
    rows.push(...data);
    offset += data.length;
  }
}

export async function loadCalendarPlans(userId: string, signal: AbortSignal) {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || user?.id !== userId) throw new Error('Sign in again to view your plans.');
  const [activities, memberships, offers, requests] = await Promise.all([
    allPages<CalendarActivity>((from, to) => supabase.from('activities')
      .select('id, title, date_time, host_id, status, location, formatted_address')
      .not('date_time', 'is', null).order('id').range(from, to).abortSignal(signal), signal),
    allPages<{ activity_id: string }>((from, to) => supabase.from('rsvps').select('activity_id')
      .eq('user_id', userId).order('activity_id').range(from, to).abortSignal(signal), signal),
    allPages<CalendarRide>((from, to) => supabase.from('rides_offered').select(RIDE_FIELDS)
      .eq('driver_id', userId).in('status', ACTIVE_RIDE_STATUSES)
      .order('id').range(from, to).abortSignal(signal), signal),
    allPages<{ ride_id: string | null }>((from, to) => supabase.from('ride_requests').select('ride_id, id')
      .eq('requester_id', userId).eq('status', 'accepted')
      .order('id').range(from, to).abortSignal(signal), signal),
  ]);
  const offerIds = new Set(offers.map(ride => ride.id));
  const passengerIds = [...new Set(requests.flatMap(request => request.ride_id && !offerIds.has(request.ride_id) ? [request.ride_id] : []))];
  const rides = [...offers];
  // Bound URL size for users with many accepted rides.
  for (let index = 0; index < passengerIds.length; index += 100) {
    const ids = passengerIds.slice(index, index + 100);
    rides.push(...await allPages<CalendarRide>((from, to) => supabase.from('rides_offered').select(RIDE_FIELDS)
      .in('id', ids).in('status', ACTIVE_RIDE_STATUSES)
      .order('id').range(from, to).abortSignal(signal), signal));
  }
  return buildCalendarPlans({ activities, joinedIds: new Set(memberships.map(row => row.activity_id)), rides }, userId);
}

export function subscribeToCalendarPlans(onChange: () => void) {
  const channel = supabase.channel(`calendar-plans-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  // Removed rows may contain only their primary key. Reads still use the
  // signed-in user's permissions and filters.
  for (const table of ['activities', 'rsvps', 'rides_offered', 'ride_requests']) {
    channel.on('postgres_changes', { event: '*', schema: 'public', table }, onChange);
  }
  channel.subscribe(status => { if (status === 'SUBSCRIBED') onChange(); });
  return () => { void supabase.removeChannel(channel); };
}
