begin;

-- One row per (activity, viewer): a view counts once per person, so reopening an activity
-- can't inflate its featured score.
create table if not exists public.activity_views (
  activity_id uuid not null references public.activities(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (activity_id, user_id)
);

alter table public.activity_views enable row level security;
grant all on public.activity_views to service_role;
-- No direct client access: views are written by record_activity_view() and only ever read
-- back as aggregate counts through featured_activity_scores().

create or replace function public.record_activity_view(p_activity_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.activity_views (activity_id, user_id)
  select a.id, auth.uid()
  from public.activities a
  where a.id = p_activity_id
    and auth.uid() is not null
    and a.host_id <> auth.uid() -- hosts looking at their own activity don't count
  on conflict (activity_id, user_id) do nothing;
$$;

grant execute on function public.record_activity_view(uuid) to authenticated;

-- Engagement score for the Home "Featured" carousel. Weights:
--   attendee (rsvp) 3, save 2, unique viewer 0.5, ride sharing enabled 3,
--   rider (pending/accepted/completed request on a live ride offer for the activity) 2.
-- is_full is returned separately so the client can rank full activities last.
-- Security definer because saves and views are private per user; only aggregate counts leave
-- the function, and only for upcoming activities the caller can see on Home. Undated and past
-- activities are excluded (the nightly expiry job leaves past ones 'active' until midnight).
create or replace function public.featured_activity_scores(p_activity_ids uuid[])
returns table (activity_id uuid, score numeric, is_full boolean)
language sql
stable
security definer
set search_path = public
as $$
  select
    a.id,
    3 * coalesce(r.n, 0)
      + 2 * coalesce(s.n, 0)
      + 0.5 * coalesce(v.n, 0)
      + case when a.ride_sharing then 3 else 0 end
      + 2 * coalesce(rd.n, 0),
    a.max_attendees is not null and coalesce(r.n, 0) >= a.max_attendees
  from public.activities a
  left join lateral (select count(*) n from public.rsvps where activity_id = a.id) r on true
  left join lateral (select count(*) n from public.saved_activities where activity_id = a.id) s on true
  left join lateral (select count(*) n from public.activity_views where activity_id = a.id) v on true
  left join lateral (
    select count(*) n
    from public.ride_requests rq
    join public.rides_offered ro on ro.id = rq.ride_id
    where ro.activity_id = a.id
      and ro.status <> 'cancelled'
      and rq.status in ('pending', 'accepted', 'completed')
  ) rd on true
  where a.id = any(p_activity_ids)
    and a.status = 'active'
    and a.date_time is not null
    and a.date_time > now()
    and (
      a.event_type = 'public'
      or a.host_id = auth.uid()
      or exists (
        select 1 from public.follows f
        where f.follower_id = auth.uid()
          and f.following_id = a.host_id
          and f.status = 'accepted'
      )
    );
$$;

grant execute on function public.featured_activity_scores(uuid[]) to authenticated;

commit;
