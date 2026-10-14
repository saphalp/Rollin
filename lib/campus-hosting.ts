import { supabase } from '@/lib/supabase';
import { getCurrentUniversity } from '@/lib/university';
import { campusUpcoming, type CampusEvent } from '@/lib/home-campus-events';
import { isAcademicCalendar } from '@/lib/home-feed';
export async function loadHostableCampusEvent(id: string) {
  const university = await getCurrentUniversity();
  if (!university?.calendar_enabled) throw new Error('Verify your supported university email to view campus events.');
  const { data, error } = await supabase.from('campus_events').select('*').eq('campus', university.id).eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || isAcademicCalendar(data)) throw new Error('This campus event is unavailable.');
  return { event: data as CampusEvent, university };
}
export async function ownHostedActivity(eventId: string, userId: string) {
  const { data, error } = await supabase.from('activities').select('id').eq('host_id', userId).eq('source_campus_event_id', eventId).maybeSingle();
  if (error) throw new Error(error.message);
  return data?.id as string | undefined;
}
export function defaultMeetingLocal(event: CampusEvent): string {
  if (event.date_only) return `${event.start_date ?? ''} 12:00`;
  if (!event.starts_at) return '';
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: event.time_zone ?? 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(event.starts_at));
  const part = (name: string) => parts.find(p => p.type === name)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')} ${part('hour')}:${part('minute')}`;
}
export async function hostCampusEvent(event: CampusEvent, userId: string, values: {
  meetingLocal: string; location: string; category: string; capacity: number; sharing: boolean;
  visibility: 'public' | 'private'; description: string; latitude: number | null; longitude: number | null;
}) {
  if (!campusUpcoming(event, Date.now())) throw new Error('This campus event has ended or was canceled.');
  const { data, error } = await supabase.rpc('host_campus_event', {
    event_id: event.id, expected_user_id: userId, meeting_local: values.meetingLocal.trim(), meeting_location: values.location.trim(),
    activity_category: values.category, capacity: values.capacity, sharing: values.sharing, visibility: values.visibility,
    activity_description: values.description.trim(), meeting_latitude: values.latitude, meeting_longitude: values.longitude,
  });
  if (error) throw new Error(error.message);
  if (typeof data !== 'string') throw new Error('Hosting did not finish. Please retry.');
  return data;
}
