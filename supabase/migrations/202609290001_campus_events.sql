begin;

-- Dedicated imports preserve official IDs and date-only events.
create table public.campus_events (
  id uuid primary key default gen_random_uuid(),
  campus text not null check (campus = 'latech'),
  source_id text not null,
  title text not null,
  description text,
  official_url text not null,
  category text,
  tags text[] not null default '{}',
  location text,
  room text,
  organizer text,
  image_url text,
  status text not null default 'CONFIRMED',
  featured boolean not null default false,
  starts_at timestamptz,
  ends_at timestamptz,
  start_date date,
  end_date date,
  date_only boolean not null,
  synced_at timestamptz not null default now(),
  unique (campus, source_id),
  check (
    (date_only and start_date is not null and end_date is not null and end_date >= start_date
      and starts_at is null and ends_at is null)
    or
    (not date_only and starts_at is not null and ends_at is not null and ends_at >= starts_at
      and start_date is null and end_date is null)
  )
);

create index campus_events_start_time on public.campus_events(starts_at);
create index campus_events_start_date on public.campus_events(start_date);
alter table public.campus_events enable row level security;

-- Read the authoritative Auth record; never trust editable profile metadata.
create function public.can_view_latech_events()
returns boolean language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from auth.users u
    where u.id = auth.uid()
      and u.email_confirmed_at is not null
      and lower(split_part(u.email, '@', 2))
        in ('latech.edu', 'email.latech.edu')
  );
$$;
revoke all on function public.can_view_latech_events() from public;
grant execute on function public.can_view_latech_events() to authenticated;

revoke all on public.campus_events from anon, authenticated;
grant select on public.campus_events to authenticated;
grant all on public.campus_events to service_role;
create policy campus_events_read on public.campus_events
for select to authenticated
using (campus = 'latech' and (select public.can_view_latech_events()));

-- Time-based views avoid a separate archival job and preserve history.
-- Provisional convention: a date-only end is the final included campus day.
create view public.upcoming_campus_events with (security_invoker = true) as
select * from public.campus_events
where upper(status) not in ('CANCELLED', 'CANCELED')
  and case when date_only
    then end_date >= (now() at time zone 'America/Chicago')::date
    else ends_at > now() end;

create view public.past_campus_events with (security_invoker = true) as
select * from public.campus_events
where case when date_only
    then end_date < (now() at time zone 'America/Chicago')::date
    else ends_at <= now() end;

revoke all on public.upcoming_campus_events, public.past_campus_events from anon, authenticated;
grant select on public.upcoming_campus_events, public.past_campus_events to authenticated;
commit;
