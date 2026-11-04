-- Offering a ride on a passenger's ride request ("ride_wanted_requests") used to create an
-- unrelated ride and flip the request to 'fulfilled', so the passenger never joined the ride
-- and none of the normal ride workflow (pickups, live tracking, arrival, completion, ratings)
-- applied. offer_ride_for_wanted_request does it in one transaction instead:
--   1. creates the driver's ride with the request's pickup, destination and time (the driver
--      can't change them; they only choose seats and notes),
--   2. adds the passenger to that ride and accepts them through accept_ride_request, exactly
--      like an accepted seat request on any other ride,
--   3. marks the request fulfilled and links it to the ride (offered_ride_id, which existed
--      on the table but was never filled in).
--
-- It also fixes the ride_requests notification triggers, which this flow relies on:
--   - notify_on_ride_confirmed checked for status 'confirmed', which ride_requests never uses
--     (its check constraint allows pending/accepted/rejected/cancelled/completed), so no
--     passenger was ever told they were accepted. It now fires on pending -> accepted.
--   - notify_on_ride_request ran from two identical insert triggers, so drivers got every
--     seat request twice. The duplicate trigger is dropped.
--   - notify_on_ride_request skips the momentary pending row offer_ride_for_wanted_request
--     inserts, so drivers aren't told about a "seat request" for their own offer.

begin;

drop trigger if exists on_ride_request_insert on public.ride_requests;

-- Same as the live notify_on_ride_request, plus the early return for a driver's own offer.
create or replace function public.notify_on_ride_request()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_offerer_id uuid;
  v_requester_name text;
  v_activity_title text;
  v_destination text;
  v_message text;
begin
  -- Only notify for a brand-new pending request.
  if new.status <> 'pending' then
    return new;
  end if;

  -- The driver is adding this passenger themselves (offer_ride_for_wanted_request).
  if coalesce(current_setting('rollin.wanted_request_offer', true), '') = new.requester_id::text then
    return new;
  end if;

  select r.driver_id, r.destination
  into v_offerer_id, v_destination
  from public.rides_offered r
  where r.id = new.ride_id;

  if v_offerer_id is null then
    return new;
  end if;

  select coalesce(nullif(trim(p.full_name), ''), 'Someone')
  into v_requester_name
  from public.profiles p
  where p.id = new.requester_id;

  v_requester_name := coalesce(v_requester_name, 'Someone');

  if new.activity_id is not null then
    select a.title into v_activity_title from public.activities a where a.id = new.activity_id;
    v_message := v_requester_name || ' requested a seat for ' || coalesce(v_activity_title, 'your activity ride');
  else
    v_message := v_requester_name || ' requested a seat for your ride to ' || coalesce(v_destination, 'your destination');
  end if;

  insert into public.notifications (user_id, actor_id, activity_id, type, message)
  values (v_offerer_id, new.requester_id, new.activity_id, 'ride_request', v_message);

  return new;
end $$;

-- Tells the passenger their seat was accepted. Uses the same notification columns and the
-- 'ride_request' type as notify_on_ride_request, so it fits whatever the notifications
-- table already accepts.
create or replace function public.notify_on_ride_confirmed()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_driver_name text;
  v_activity_title text;
  v_destination text;
begin
  if new.status = 'accepted' and old.status = 'pending' then
    select coalesce(nullif(trim(p.full_name), ''), 'Your driver')
    into v_driver_name
    from public.profiles p
    where p.id = new.driver_id;

    select r.destination into v_destination from public.rides_offered r where r.id = new.ride_id;

    if new.activity_id is not null then
      select a.title into v_activity_title from public.activities a where a.id = new.activity_id;
    end if;

    insert into public.notifications (user_id, actor_id, activity_id, type, message)
    values (
      new.requester_id, new.driver_id, new.activity_id, 'ride_request',
      coalesce(v_driver_name, 'Your driver') || ' accepted you on their ride to '
        || coalesce(v_activity_title, v_destination, 'your destination') || '.'
    );
  end if;

  return new;
end $$;

-- Same as the latest validate_request_pickup (20261102120000), plus one rule on INSERT: the
-- requester may differ from the caller only while offer_ride_for_wanted_request is adding
-- that exact requester (it sets the transaction-local rollin.wanted_request_offer flag).
-- Clients can't set that flag through the API, so direct inserts keep the old rule.
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
    if new.driver_id is distinct from r.driver_id
       or (new.requester_id is distinct from auth.uid()
           and coalesce(current_setting('rollin.wanted_request_offer', true), '') <> new.requester_id::text)
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

-- The coordinates come from the driver's device geocoding the request's own addresses; the
-- addresses themselves are always copied from the request.
create or replace function public.offer_ride_for_wanted_request(
  p_wanted_request_id uuid,
  p_available_seats integer,
  p_notes text,
  p_pickup_latitude double precision,
  p_pickup_longitude double precision,
  p_destination_latitude double precision,
  p_destination_longitude double precision
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  w public.ride_wanted_requests;
  v_ride_id uuid;
  v_request_id uuid;
begin
  if auth.uid() is null then raise exception 'Sign in to offer a ride'; end if;

  select * into w from public.ride_wanted_requests where id = p_wanted_request_id for update;
  if not found or w.status <> 'open' then raise exception 'This ride request is no longer open'; end if;
  if w.requester_id = auth.uid() then raise exception 'You cannot offer a ride on your own request'; end if;
  if w.date_time is null or w.date_time <= now() then raise exception 'This ride request has already passed'; end if;
  if p_available_seats is null or p_available_seats < 1 then
    raise exception 'Offer at least one seat';
  end if;
  -- Same rule as the ride_requests_one_active_request_per_activity index, with a readable error.
  if w.activity_id is not null and exists (
    select 1 from public.ride_requests
    where requester_id = w.requester_id and activity_id = w.activity_id and status in ('pending', 'accepted')
  ) then
    raise exception 'This passenger already has a ride for this activity';
  end if;
  if p_pickup_latitude is null or p_pickup_longitude is null
     or p_destination_latitude is null or p_destination_longitude is null
     or not (p_pickup_latitude between -90 and 90) or not (p_pickup_longitude between -180 and 180)
     or not (p_destination_latitude between -90 and 90) or not (p_destination_longitude between -180 and 180) then
    raise exception 'Could not locate the requested pickup or destination';
  end if;

  -- Driver verification is still enforced by require_verified_driver_for_ride_offer.
  insert into public.rides_offered (
    driver_id, activity_id, pickup_mode, pickup_location, pickup_latitude, pickup_longitude,
    destination, destination_latitude, destination_longitude, date_time, available_seats, notes, status
  ) values (
    auth.uid(), w.activity_id, 'fixed', w.pickup_location, p_pickup_latitude, p_pickup_longitude,
    w.destination, p_destination_latitude, p_destination_longitude, w.date_time, p_available_seats,
    nullif(trim(coalesce(p_notes, '')), ''), 'open'
  ) returning id into v_ride_id;

  perform set_config('rollin.wanted_request_offer', w.requester_id::text, true);
  insert into public.ride_requests (ride_id, activity_id, requester_id, driver_id, status)
  values (v_ride_id, w.activity_id, w.requester_id, auth.uid(), 'pending')
  returning id into v_request_id;
  perform set_config('rollin.wanted_request_offer', '', true);

  -- Same acceptance path (seat count, ride status) as a driver accepting a seat request.
  perform public.accept_ride_request(v_request_id);

  update public.ride_wanted_requests
  set status = 'fulfilled', offered_ride_id = v_ride_id
  where id = w.id;

  return v_ride_id;
end $$;

revoke all on function public.offer_ride_for_wanted_request(uuid, integer, text, double precision,
  double precision, double precision, double precision) from public;
grant execute on function public.offer_ride_for_wanted_request(uuid, integer, text, double precision,
  double precision, double precision, double precision) to authenticated;

notify pgrst, 'reload schema';
commit;
