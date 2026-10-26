export type ActivityFilter = 'mine' | 'created' | 'joined' | 'all';
export type CalendarActivity = {
  id: string; title: string; date_time: string | null; host_id: string | null;
  status: string | null; location: string | null; formatted_address: string | null;
};
export type CalendarRide = {
  id: string; driver_id: string; date_time: string | null; status: string;
  pickup_location: string | null; destination: string | null;
};
export type CalendarPlan = {
  key: string; id: string; kind: 'activity' | 'ride'; title: string; startsAt: number;
  location: string; created: boolean; joined: boolean; label: string;
};
export type CalendarSnapshot = { activities: CalendarActivity[]; joinedIds: Set<string>; rides: CalendarRide[] };

export function calendarDay(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function buildCalendarPlans(snapshot: CalendarSnapshot, userId: string): CalendarPlan[] {
  const plans = new Map<string, CalendarPlan>();
  for (const activity of snapshot.activities) {
    const startsAt = activity.date_time ? Date.parse(activity.date_time) : NaN;
    if (!Number.isFinite(startsAt) || ['cancelled', 'canceled'].includes(activity.status?.toLowerCase() ?? '')) continue;
    const created = activity.host_id === userId;
    const joined = snapshot.joinedIds.has(activity.id);
    const key = `activity:${activity.id}`;
    plans.set(key, { key, id: activity.id, kind: 'activity', title: activity.title, startsAt,
      location: activity.formatted_address || activity.location || '', created, joined,
      label: created ? 'Hosting' : joined ? 'Joined' : 'Activity' });
  }
  // The loader supplies only this user's offers and accepted passenger rides.
  for (const ride of snapshot.rides) {
    const startsAt = ride.date_time ? Date.parse(ride.date_time) : NaN;
    if (!Number.isFinite(startsAt) || !['open', 'full', 'in_progress'].includes(ride.status)) continue;
    const created = ride.driver_id === userId;
    const key = `ride:${ride.id}`;
    plans.set(key, { key, id: ride.id, kind: 'ride', startsAt, created, joined: !created,
      title: ride.destination ? `Ride to ${ride.destination}` : 'Ride',
      location: ride.pickup_location ? `From ${ride.pickup_location}` : 'Individual pickups',
      label: created ? 'Driving' : 'Accepted seat' });
  }
  return [...plans.values()].sort((a, b) => a.startsAt - b.startsAt || a.key.localeCompare(b.key));
}

export function filterCalendarPlans(plans: CalendarPlan[], filter: ActivityFilter, includeRides: boolean): CalendarPlan[] {
  return plans.filter(plan => plan.kind === 'ride' ? includeRides
    : filter === 'all' || filter === 'created' && plan.created || filter === 'joined' && plan.joined
      || filter === 'mine' && (plan.created || plan.joined));
}

export function groupCalendarPlans(plans: CalendarPlan[]): { day: string; plans: CalendarPlan[] }[] {
  const days = new Map<string, CalendarPlan[]>();
  for (const plan of plans) {
    const day = calendarDay(plan.startsAt);
    const group = days.get(day) ?? [];
    group.push(plan);
    days.set(day, group);
  }
  return [...days].map(([day, plans]) => ({ day, plans }));
}

export function calendarPlanRoute(plan: CalendarPlan) {
  return { pathname: plan.kind === 'ride' ? '/ride/[id]' as const : '/activity/[id]' as const, params: { id: plan.id } };
}
