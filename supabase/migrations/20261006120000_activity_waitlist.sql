begin;

create table if not exists public.waitlist (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique (activity_id, user_id)
);

create index if not exists waitlist_activity_joined_idx
  on public.waitlist (activity_id, joined_at);

alter table public.waitlist enable row level security;

grant select, insert, delete on public.waitlist to authenticated;
grant all on public.waitlist to service_role;
grant select on public.activities to service_role;
grant insert on public.notifications to service_role;
grant insert on public.rsvps to service_role;

drop policy if exists "Users can join waitlists" on public.waitlist;
create policy "Users can join waitlists" on public.waitlist
for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists "Users can view their own waitlist spots" on public.waitlist;
create policy "Users can view their own waitlist spots" on public.waitlist
for select to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can leave waitlists" on public.waitlist;
create policy "Users can leave waitlists" on public.waitlist
for delete to authenticated
using (user_id = auth.uid());

create or replace function public.my_waitlist_positions()
returns table (activity_id uuid, position_in_line integer)
language sql
stable
security definer
set search_path = public
as $$
  select mine.activity_id,
    (select count(*)::int from public.waitlist w
     where w.activity_id = mine.activity_id
       and w.joined_at <= mine.joined_at)
  from public.waitlist mine
  where mine.user_id = auth.uid();
$$;

grant execute on function public.my_waitlist_positions() to authenticated;

commit;