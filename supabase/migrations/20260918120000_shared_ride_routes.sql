begin;
create table if not exists public.ride_routes (
  ride_id uuid primary key references public.rides_offered(id) on delete cascade,
  route jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.ride_routes enable row level security;
grant select, insert, update on public.ride_routes to authenticated;

drop policy if exists "Participants read shared route" on public.ride_routes;
drop policy if exists "Driver inserts shared route" on public.ride_routes;
drop policy if exists "Driver updates shared route" on public.ride_routes;

create policy "Participants read shared route" on public.ride_routes
for select to authenticated using (
  exists (select 1 from public.rides_offered r where r.id = ride_id and r.driver_id = auth.uid())
  or exists (select 1 from public.ride_requests q where q.ride_id = ride_routes.ride_id
    and q.requester_id = auth.uid() and q.status = 'accepted')
);
create policy "Driver inserts shared route" on public.ride_routes
for insert to authenticated with check (
  exists (select 1 from public.rides_offered r where r.id = ride_id
    and r.driver_id = auth.uid() and r.status in ('open', 'full', 'in_progress'))
);
create policy "Driver updates shared route" on public.ride_routes
for update to authenticated using (
  exists (select 1 from public.rides_offered r where r.id = ride_id and r.driver_id = auth.uid())
) with check (
  exists (select 1 from public.rides_offered r where r.id = ride_id
    and r.driver_id = auth.uid() and r.status in ('open', 'full', 'in_progress'))
);
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime'
    and schemaname = 'public' and tablename = 'ride_routes') then
    alter publication supabase_realtime add table public.ride_routes;
  end if;
end $$;
commit;
