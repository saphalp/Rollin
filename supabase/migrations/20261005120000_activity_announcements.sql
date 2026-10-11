begin; 

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (length(trim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);
alter table public.announcements enable row level security;
grant select, insert on public.announcements to authenticated;
grant all on public.announcements to service_role;
grant select on public.rsvps to service_role;


drop policy if exists "Hosts can post announcements" on public.announcements;
create policy "Hosts can post announcements" on public.announcements
for insert to authenticated
with check (
  author_id = auth.uid() and exists (
    select 1 from public.activities a
    where a.id = announcements.activity_id and a.host_id = auth.uid()
  )
);

drop policy if exists "Hosts and members can view announcements" on public.announcements;
create policy "Hosts and members can view announcements" on public.announcements
for select to authenticated
using (
  exists (
    select 1 from public.activities a
    where a.id = announcements.activity_id and a.host_id = auth.uid()
  )
  or exists (
    select 1 from public.rsvps r
    where r.activity_id = announcements.activity_id and r.user_id = auth.uid()
  )
);

commit; 