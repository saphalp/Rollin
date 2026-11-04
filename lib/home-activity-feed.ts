// Home feed queries: a paged, searchable list of activities plus the Featured candidates.
import { resolveAvatarUri } from '@/lib/profile/resolve-avatar-uri';
import { supabase } from '@/lib/supabase';

const CATEGORY_IMAGES: Record<string, string> = {
  social: 'https://picsum.photos/seed/social/900/500',
  sports: 'https://picsum.photos/seed/sports/900/500',
  music: 'https://picsum.photos/seed/music/900/500',
  study: 'https://picsum.photos/seed/study/900/500',
  outdoor: 'https://picsum.photos/seed/outdoor/900/500',
  gaming: 'https://picsum.photos/seed/gaming/900/500',
  grocery: 'https://picsum.photos/seed/grocery/900/500',
};

export type Activity = {
  id: string;
  title: string;
  category: string;
  sortKey: string;
  startsAt: number | null;
  date?: string;
  location?: string;
  hostName?: string;
  hostAvatarUrl?: string;
  imageUrl?: string;
  attendeeCount: number;
  maxAttendees: number;
  rideSharing?: boolean;
  isCampusEvent?: boolean;
  waitlistPosition?: number | null;
  status?: 'active' | 'expired';
};

function formatDate(dateStr: string | null): string | undefined {
  if (!dateStr) return undefined;
  return new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

// Activities per page in the list; Load more fetches the next page.
export const PAGE_SIZE = 8;
// Featured is chosen from this many of the soonest upcoming activities.
export const FEATURED_CANDIDATES = 60;
const ACTIVITY_COLUMNS =
  'id, title, category, date_time, location, max_attendees, ride_sharing, event_type, image_url, status, source_campus_event_id, rsvps(id), host:profiles!host_id(full_name, profile_picture)';

export type FeedContext = {
  visibleHostIds: string[];
  category: string;
  search: string;
  positions: Map<string, number>;
  featuredIds: string[];
};

/** Active activities the viewer can see, soonest first, narrowed by category and search. */
export function buildActivityQuery(context: FeedContext) {
  let query = supabase.from('activities')
    .select(ACTIVITY_COLUMNS)
    .eq('status', 'active')
    .order('date_time', { ascending: true }).order('id');
  query = context.visibleHostIds.length > 0
    ? query.or(`event_type.eq.public,and(event_type.eq.private,host_id.in.(${context.visibleHostIds.join(',')}))`)
    : query.eq('event_type', 'public');
  if (context.category !== 'All') {
    query = query.eq('category', context.category.toLowerCase());
  }
  // Characters that would break PostgREST's or() syntax or act as wildcards are dropped.
  const term = context.search.replace(/[%_*,()\\]/g, ' ').trim();
  if (term) {
    query = query.or(`title.ilike.%${term}%,location.ilike.%${term}%`);
  }
  return query;
}

/** One page of the list (Featured activities excluded). Fetches one extra row to know if there's more. */
export async function fetchListPage(context: FeedContext, offset: number, count: number) {
  let query = buildActivityQuery(context);
  if (context.featuredIds.length > 0) {
    query = query.not('id', 'in', `(${context.featuredIds.join(',')})`);
  }
  const { data, error } = await query.range(offset, offset + count);
  if (error) throw error;
  const rows = data ?? [];
  return {
    activities: rows.slice(0, count).map(row => toActivity(row, context.positions)),
    hasMore: rows.length > count,
  };
}

export function toActivity(a: any, positions: Map<string, number>): Activity {
  return {
    id: a.id, title: a.title, category: a.category ?? 'social',
    startsAt: a.date_time ? new Date(a.date_time).getTime() : null,
    sortKey: a.date_time ? `${new Date(a.date_time).toLocaleDateString('sv-SE', { timeZone: 'America/Chicago' })}T${new Date(a.date_time).toLocaleTimeString('en-GB', { timeZone: 'America/Chicago', hour12: false })}` : '9999',
    date: formatDate(a.date_time), location: a.location ?? undefined, imageUrl: a.image_url ?? CATEGORY_IMAGES[a.category],
    attendeeCount: a.rsvps?.length ?? 0, maxAttendees: a.max_attendees ?? 10,
    rideSharing: a.ride_sharing ?? false, isCampusEvent: !!a.source_campus_event_id, waitlistPosition: positions.get(a.id) ?? null, status: a.status ?? 'active',
    // No host row when their profile isn't visible to this viewer.
    hostName: a.host?.full_name?.trim() || undefined,
    hostAvatarUrl: a.host ? resolveAvatarUri(a.host.profile_picture) : undefined,
  };
}
