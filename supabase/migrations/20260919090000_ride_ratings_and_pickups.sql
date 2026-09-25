begin;

alter table public.rides_offered add column if not exists pickup_mode text not null default 'fixed'
  check (pickup_mode in ('fixed', 'individual'));
alter table public.rides_offered alter column pickup_location drop not null;
alter table public.ride_requests add column if not exists pickup_address text;
alter table public.ride_requests add column if not exists pickup_latitude double precision;
alter table public.ride_requests add column if not exists pickup_longitude double precision;
alter table public.ride_requests add column if not exists picked_up_at timestamptz;
alter table public.ride_requests add column if not exists pickup_order integer;

-- Preserve meetup addresses on requests made before individual pickups existed.
update public.ride_requests q set pickup_address = r.pickup_location,
  pickup_latitude = r.pickup_latitude, pickup_longitude = r.pickup_longitude
from public.rides_offered r where q.ride_id = r.id and q.pickup_address is null
  and r.pickup_mode = 'fixed';

-- Keep the approved pickup unchanged, even if a client bypasses the form.
create or replace function public.validate_request_pickup() returns trigger
language plpgsql set search_path = public as $$
declare r public.rides_offered;
begin
  select * into r from public.rides_offered where id = new.ride_id;
  if tg_op = 'UPDATE' then
    if new.status is distinct from old.status and auth.uid() is distinct from r.driver_id
       and not (auth.uid() = old.requester_id and old.status in ('pending','accepted') and new.status = 'cancelled') then
      raise exception 'Only the driver can accept or complete a passenger request';
    end if;
    if (new.ride_id, new.requester_id, new.driver_id) is distinct from
       (old.ride_id, old.requester_id, old.driver_id) then
      raise exception 'Ride participants cannot be changed';
    end if;
    if (new.pickup_address, new.pickup_latitude, new.pickup_longitude) is distinct from
       (old.pickup_address, old.pickup_latitude, old.pickup_longitude) and old.status <> 'pending' then
      raise exception 'Cancel and request again to change an approved pickup';
    end if;
    if (new.picked_up_at, new.pickup_order) is distinct from (old.picked_up_at, old.pickup_order)
       and auth.uid() is distinct from r.driver_id then
      raise exception 'Only the driver can manage pickups';
    end if;
  else
    if new.driver_id is distinct from r.driver_id or new.requester_id is distinct from auth.uid()
       or new.requester_id = r.driver_id then raise exception 'Invalid ride participants'; end if;
    if new.status <> 'pending' or r.status <> 'open' then raise exception 'Request an available ride first'; end if;
    new.picked_up_at := null;
    new.pickup_order := null;
  end if;
  if tg_op = 'INSERT' or (new.pickup_address, new.pickup_latitude, new.pickup_longitude) is distinct from
                         (old.pickup_address, old.pickup_latitude, old.pickup_longitude) then
    if new.pickup_address is null then
      new.pickup_address := r.pickup_location;
      new.pickup_latitude := r.pickup_latitude;
      new.pickup_longitude := r.pickup_longitude;
    end if;
    if nullif(trim(new.pickup_address), '') is null or new.pickup_latitude is null or new.pickup_longitude is null
       or not (new.pickup_latitude between -90 and 90) or not (new.pickup_longitude between -180 and 180) then
      raise exception 'A valid pickup address is required';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists validate_request_pickup on public.ride_requests;
create trigger validate_request_pickup before insert or update on public.ride_requests
for each row execute function public.validate_request_pickup();

-- An old location watcher must not reactivate sharing after completion.
drop policy if exists "Drivers can update their ride location" on public.ride_locations;
create policy "Drivers can update their ride location" on public.ride_locations for update to authenticated
using (driver_id = auth.uid()) with check (
  driver_id = auth.uid() and exists (select 1 from public.rides_offered r
    where r.id = ride_locations.ride_id and r.driver_id = auth.uid()
      and (r.status in ('open','full','in_progress') or not ride_locations.is_active))
);

create table if not exists public.ride_ratings (
  ride_id uuid not null references public.rides_offered(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  stars integer not null check (stars between 1 and 5),
  comment text not null default '' check (length(comment) <= 1000),
  updated_at timestamptz not null default now(),
  primary key (ride_id, author_id, recipient_id),
  check (author_id <> recipient_id)
);
alter table public.ride_ratings enable row level security;
revoke all on public.ride_ratings from anon, authenticated;
grant select on public.ride_ratings to authenticated;
create policy "Read own written or received ratings" on public.ride_ratings for select to authenticated
using (auth.uid() = author_id or auth.uid() = recipient_id);

create or replace function public.save_ride_rating(p_ride_id uuid, p_recipient_id uuid, p_stars integer, p_comment text)
returns void language plpgsql security definer set search_path = public as $$
declare driver uuid;
begin
  select driver_id into driver from public.rides_offered where id = p_ride_id and status = 'completed';
  if auth.uid() is null or driver is null or p_recipient_id = auth.uid() or not exists (
    select 1 from public.ride_requests q where q.ride_id = p_ride_id and q.status in ('accepted','completed')
    and ((auth.uid() = driver and q.requester_id = p_recipient_id)
      or (p_recipient_id = driver and q.requester_id = auth.uid()))
  ) then raise exception 'Only completed ride participants can rate each other'; end if;
  insert into public.ride_ratings values (p_ride_id, auth.uid(), p_recipient_id, p_stars, coalesce(trim(p_comment), ''), now())
  on conflict (ride_id, author_id, recipient_id) do update
  set stars = excluded.stars, comment = excluded.comment, updated_at = now();
end $$;

create or replace function public.ride_rating_summary(p_user_id uuid)
returns table (average numeric, count bigint) language sql stable security definer set search_path = public as $$
  select round(avg(stars), 1), count(*) from public.ride_ratings where recipient_id = p_user_id;
$$;

-- This also provides the list of people the current user can rate in History.
create or replace function public.ride_rating_targets(p_ride_id uuid default null)
returns table (ride_id uuid, recipient_id uuid, name text, destination text)
language sql stable security definer set search_path = public as $$
  select distinct r.id, p.id, coalesce(p.full_name, 'Rollin user'), r.destination
  from public.rides_offered r join public.ride_requests q on q.ride_id = r.id
  join public.profiles p on p.id = case when auth.uid() = r.driver_id then q.requester_id else r.driver_id end
  where r.status = 'completed' and q.status in ('accepted','completed')
    and (auth.uid() = r.driver_id or auth.uid() = q.requester_id)
    and (p_ride_id is null or r.id = p_ride_id)
    and (p_ride_id is not null or not exists (select 1 from public.ride_ratings x
      where x.ride_id = r.id and x.author_id = auth.uid() and x.recipient_id = p.id));
$$;

create or replace function public.finish_ride(p_ride_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform 1 from public.rides_offered where id = p_ride_id and driver_id = auth.uid()
    and status = 'in_progress' for update;
  if not found then raise exception 'Only the driver can complete an active ride'; end if;
  update public.rides_offered set status = 'completed' where id = p_ride_id;
  update public.ride_requests set status = 'completed' where ride_id = p_ride_id and status = 'accepted';
  update public.ride_requests set status = 'rejected' where ride_id = p_ride_id and status = 'pending';
  update public.ride_locations set is_active = false, updated_at = now() where ride_id = p_ride_id;
end $$;

create or replace function public.mark_passenger_picked_up(p_request_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.ride_requests q set picked_up_at = now() from public.rides_offered r
  where q.id = p_request_id and q.ride_id = r.id and r.driver_id = auth.uid()
    and r.status = 'in_progress' and q.status = 'accepted' and q.picked_up_at is null;
  if not found then raise exception 'Pickup is unavailable'; end if;
end $$;

create or replace function public.set_pickup_order(p_ride_id uuid, p_request_ids uuid[]) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform 1 from public.rides_offered where id = p_ride_id and driver_id = auth.uid()
    and status in ('open','full','in_progress') for update;
  if not found then raise exception 'Only the driver can arrange pickups'; end if;
  if cardinality(p_request_ids) <> (select count(*) from public.ride_requests where ride_id = p_ride_id
       and status = 'accepted' and picked_up_at is null)
     or cardinality(p_request_ids) <> (select count(distinct x) from unnest(p_request_ids) x)
     or exists (select 1 from unnest(p_request_ids) x where not exists (select 1 from public.ride_requests
       where id = x and ride_id = p_ride_id and status = 'accepted' and picked_up_at is null)) then
    raise exception 'Pickup list changed. Refresh and try again';
  end if;
  update public.ride_requests q set pickup_order = x.ordinality
    from unnest(p_request_ids) with ordinality x(id, ordinality) where q.id = x.id;
end $$;

revoke all on function public.save_ride_rating(uuid,uuid,integer,text), public.ride_rating_summary(uuid),
 public.ride_rating_targets(uuid), public.finish_ride(uuid), public.mark_passenger_picked_up(uuid),
 public.set_pickup_order(uuid,uuid[]) from public;
grant execute on function public.save_ride_rating(uuid,uuid,integer,text), public.ride_rating_summary(uuid),
 public.ride_rating_targets(uuid), public.finish_ride(uuid), public.mark_passenger_picked_up(uuid),
 public.set_pickup_order(uuid,uuid[]) to authenticated;
notify pgrst, 'reload schema';
commit;
