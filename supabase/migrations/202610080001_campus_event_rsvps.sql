begin;

-- RSS events stay in campus_events; joining does not create another activity.
create table if not exists public.campus_event_rsvps (
  event_id uuid not null references public.campus_events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);
create index if not exists campus_event_rsvps_user_id_idx
  on public.campus_event_rsvps(user_id);
alter table public.campus_event_rsvps enable row level security;
revoke all on public.campus_event_rsvps from anon, authenticated;
grant select, insert, delete on public.campus_event_rsvps to authenticated;
grant all on public.campus_event_rsvps to service_role;

drop policy if exists campus_rsvp_read_own on public.campus_event_rsvps;
create policy campus_rsvp_read_own on public.campus_event_rsvps
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists campus_rsvp_join on public.campus_event_rsvps;
create policy campus_rsvp_join on public.campus_event_rsvps
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and (select public.can_view_latech_events())
    and exists (
      select 1 from public.campus_events e
      where e.id = event_id and e.campus = 'latech'
        and upper(e.status) not in ('CANCELLED', 'CANCELED')
        and case when e.date_only
          then e.end_date >= (now() at time zone 'America/Chicago')::date
          else e.ends_at > now() end
    )
  );
drop policy if exists campus_rsvp_leave on public.campus_event_rsvps;
create policy campus_rsvp_leave on public.campus_event_rsvps
  for delete to authenticated using (user_id = (select auth.uid()));

-- Return real counts and only the current viewer's Going status.
-- Attendee identities are not exposed by this aggregate endpoint.
create or replace function public.campus_event_attendance(event_ids uuid[])
returns table(event_id uuid, attendee_count bigint, going boolean)
language sql stable security definer set search_path = ''
as $$
  select e.id,
    (select count(*) from public.campus_event_rsvps r where r.event_id = e.id),
    exists (select 1 from public.campus_event_rsvps r
      where r.event_id = e.id and r.user_id = (select auth.uid()))
  from public.campus_events e
  where e.campus = 'latech' and e.id = any(event_ids)
    and (select public.can_view_latech_events());
$$;
revoke all on function public.campus_event_attendance(uuid[]) from public, anon;
grant execute on function public.campus_event_attendance(uuid[]) to authenticated;
commit;
