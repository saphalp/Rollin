begin;

create table if not exists public.universities (
  id text primary key check (id ~ '^[a-z0-9_-]+$'),
  name text not null, short_name text not null,
  time_zone text not null default 'America/Chicago',
  calendar_url text, official_hosts text[] not null default '{}',
  enabled boolean not null default true
);
create table if not exists public.university_email_domains (
  domain text primary key check (domain = lower(domain) and domain !~ '[@/[:space:]]'),
  university_id text not null references public.universities(id) on delete cascade
);
create table if not exists public.university_event_sources (
  id text primary key, university_id text not null references public.universities(id),
  provider text not null check (provider in ('moderncampus_rss', 'livewhale_json')),
  feed_url text not null check (feed_url like 'https://%'),
  allowed_feed_hosts text[] not null, expected_feed_title text,
  enabled boolean not null default true, last_synced_at timestamptz, last_error text,
  unique (university_id, feed_url)
);

insert into public.universities(id,name,short_name,time_zone,calendar_url,official_hosts) values
('latech','Louisiana Tech University','LA Tech','America/Chicago','https://www.latech.edu/events.php',array['www.latech.edu','latech.edu']),
('ulm','University of Louisiana Monroe','ULM','America/Chicago','https://calendar.ulm.edu/',array['calendar.ulm.edu','www.ulm.edu','ulm.edu'])
on conflict (id) do nothing;
insert into public.university_email_domains(domain,university_id) values
('latech.edu','latech'),('email.latech.edu','latech'),('warhawks.ulm.edu','ulm'),('ulm.edu','ulm')
on conflict (domain) do nothing;
insert into public.university_event_sources(id,university_id,provider,feed_url,allowed_feed_hosts,expected_feed_title) values
('latech-main','latech','moderncampus_rss','https://api.calendar.moderncampus.net/pubcalendar/9a424096-0a54-475e-a112-ec2fb41d5fa1/rss?url=https%3A%2F%2Fwww.latech.edu%2Fevents.php&hash=true',array['api.calendar.moderncampus.net'],'Louisiana Tech University'),
('ulm-main','ulm','livewhale_json','https://calendar.ulm.edu/live/json/events/group/Main%20Calendar/max/1000',array['calendar.ulm.edu'],null)
on conflict (id) do nothing;

alter table public.universities enable row level security;
alter table public.university_email_domains enable row level security;
alter table public.university_event_sources enable row level security;
revoke all on public.universities, public.university_email_domains, public.university_event_sources from anon, authenticated;
grant select on public.universities, public.university_email_domains to anon, authenticated;
grant all on public.universities, public.university_email_domains, public.university_event_sources to service_role;
drop policy if exists universities_read on public.universities;
create policy universities_read on public.universities for select to anon, authenticated using (enabled);
drop policy if exists university_domains_read on public.university_email_domains;
create policy university_domains_read on public.university_email_domains for select to anon, authenticated
using (exists(select 1 from public.universities u where u.id = university_id and u.enabled));

-- Reads authoritative Auth email. Profile/user_metadata cannot choose a campus.
create or replace function public.current_university_id()
returns text language sql stable security definer set search_path = '' as $$
  select d.university_id from auth.users a
  join public.university_email_domains d on d.domain = lower(split_part(a.email,'@',2))
  join public.universities u on u.id = d.university_id and u.enabled
  where a.id = (select auth.uid()) and a.email_confirmed_at is not null
  limit 1;
$$;
revoke all on function public.current_university_id() from public, anon;
grant execute on function public.current_university_id() to authenticated;
create or replace function public.current_university()
returns table(id text,name text,short_name text,time_zone text,official_hosts text[],calendar_enabled boolean)
language sql stable security definer set search_path = '' as $$
  select u.id,u.name,u.short_name,u.time_zone,u.official_hosts,
    exists(select 1 from public.university_event_sources s where s.university_id=u.id and s.enabled)
  from public.universities u where u.id=(select public.current_university_id()) and u.enabled;
$$;
revoke all on function public.current_university() from public, anon;
grant execute on function public.current_university() to authenticated;
-- Legacy helper continues to mean LA Tech only, for old clients.
create or replace function public.can_view_latech_events()
returns boolean language sql stable security definer set search_path='' as $$
  select coalesce((select public.current_university_id())='latech',false);
$$;
revoke all on function public.can_view_latech_events() from public, anon;
grant execute on function public.can_view_latech_events() to authenticated;

-- Retain existing UUIDs/source IDs, so existing LA Tech Going records survive.
alter table public.campus_events drop constraint if exists campus_events_campus_check;
do $$ begin
  if not exists(select 1 from pg_constraint where conrelid='public.campus_events'::regclass and conname='campus_events_university_fk') then
    alter table public.campus_events add constraint campus_events_university_fk foreign key(campus) references public.universities(id);
  end if;
end $$;
alter table public.campus_events add column if not exists time_zone text not null default 'America/Chicago';
alter table public.campus_events add column if not exists source_config_id text references public.university_event_sources(id);
revoke all on public.campus_events from anon, authenticated;
grant select on public.campus_events to authenticated;
grant all on public.campus_events to service_role;
alter table public.campus_events enable row level security;
drop policy if exists campus_events_read on public.campus_events;
create policy campus_events_read on public.campus_events for select to authenticated
using (campus=(select public.current_university_id()));

create table if not exists public.campus_event_rsvps (
 event_id uuid not null references public.campus_events(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),primary key(event_id,user_id)
);
create index if not exists campus_event_rsvps_user_id_idx on public.campus_event_rsvps(user_id);
alter table public.campus_event_rsvps enable row level security;
revoke all on public.campus_event_rsvps from anon, authenticated;
grant select,insert,delete on public.campus_event_rsvps to authenticated;
grant all on public.campus_event_rsvps to service_role;
drop policy if exists campus_rsvp_read_own on public.campus_event_rsvps;
create policy campus_rsvp_read_own on public.campus_event_rsvps for select to authenticated using(user_id=(select auth.uid()));
drop policy if exists campus_rsvp_join on public.campus_event_rsvps;
create policy campus_rsvp_join on public.campus_event_rsvps for insert to authenticated with check (
 user_id=(select auth.uid()) and exists(
  select 1 from public.campus_events e where e.id=event_id and e.campus=(select public.current_university_id())
  and upper(e.status) not in ('CANCELLED','CANCELED')
  and case when e.date_only then e.end_date >= (now() at time zone e.time_zone)::date else e.ends_at>now() end
 )
);
drop policy if exists campus_rsvp_leave on public.campus_event_rsvps;
create policy campus_rsvp_leave on public.campus_event_rsvps for delete to authenticated using(user_id=(select auth.uid()));
create or replace function public.campus_event_attendance(event_ids uuid[])
returns table(event_id uuid,attendee_count bigint,going boolean)
language sql stable security definer set search_path='' as $$
 select e.id,
 (select count(*) from public.campus_event_rsvps r where r.event_id=e.id),
 exists(select 1 from public.campus_event_rsvps r where r.event_id=e.id and r.user_id=(select auth.uid()))
 from public.campus_events e where e.id=any(event_ids) and e.campus=(select public.current_university_id());
$$;
revoke all on function public.campus_event_attendance(uuid[]) from public,anon;
grant execute on function public.campus_event_attendance(uuid[]) to authenticated;

create or replace view public.upcoming_campus_events with(security_invoker=true) as
select * from public.campus_events e where upper(e.status) not in ('CANCELLED','CANCELED')
and case when e.date_only then e.end_date >= (now() at time zone e.time_zone)::date else e.ends_at>now() end;
create or replace view public.past_campus_events with(security_invoker=true) as
select * from public.campus_events e where case when e.date_only then e.end_date < (now() at time zone e.time_zone)::date else e.ends_at<=now() end;
revoke all on public.upcoming_campus_events,public.past_campus_events from anon,authenticated;
grant select on public.upcoming_campus_events,public.past_campus_events to authenticated;
grant usage on schema public to anon,authenticated;
notify pgrst,'reload schema';
commit;
