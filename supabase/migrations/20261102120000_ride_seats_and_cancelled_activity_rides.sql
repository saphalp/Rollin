-- Fixes two ride bugs:
--   1. Seats weren't restored when an accepted passenger cancelled.
--   2. Cancelling an activity left its rides and ride requests active.

begin;

-- 1. Give a seat back when an accepted passenger cancels (or is removed).
create or replace function public.restore_seat_on_request_cancel()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status = 'accepted' and new.status in ('cancelled', 'rejected') then
    update rides_offered
    set available_seats = available_seats + 1,
        status = case when status = 'full' then 'open' else status end
    -- Only for rides that are still taking passengers
    where id = new.ride_id
      and status in ('open', 'full');
  end if;
  return new;
end;
$$;

drop trigger if exists restore_seat_on_request_cancel on public.ride_requests;
create trigger restore_seat_on_request_cancel
  after update of status on public.ride_requests
  for each row execute function public.restore_seat_on_request_cancel();

-- 2. Let requests on a cancelled ride be cancelled too.
-- Same as the existing validate_request_pickup, plus one rule on the first check:
-- a request can move to 'cancelled' when its ride is already cancelled.
create or replace function public.validate_request_pickup()
returns trigger
language plpgsql
set search_path to 'public'
as $$
declare r public.rides_offered;
begin
  select * into r from public.rides_offered where id = new.ride_id;
  if tg_op = 'UPDATE' then
    if new.status is distinct from old.status and auth.uid() is distinct from r.driver_id
       and not (auth.uid() = old.requester_id and old.status in ('pending','accepted') and new.status = 'cancelled')
       and not (r.status = 'cancelled' and old.status in ('pending','accepted') and new.status = 'cancelled') then
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

-- 3. cancel-activity now also cancels the activity's rides and requests.
grant select, update on public.rides_offered to service_role;
grant select, update on public.ride_requests to service_role;
grant select, update on public.ride_wanted_requests to service_role;

commit;