-- Tell the driver when a passenger cancels their seat (accepted) or withdraws a seat request
-- (pending). Only fires when the passenger themselves cancels: requests cancelled because the
-- driver cancelled the ride, or by the cancel-activity function (no signed-in user), don't
-- notify the driver about something they or the host did.
-- Uses the same notification columns and 'ride_request' type as notify_on_ride_request.

begin;

create or replace function public.notify_on_ride_request_cancelled()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_driver_id uuid;
  v_destination text;
  v_activity_title text;
  v_requester_name text;
begin
  if new.status <> 'cancelled' or old.status not in ('pending', 'accepted') then
    return new;
  end if;
  if auth.uid() is null or auth.uid() is distinct from new.requester_id then
    return new;
  end if;

  select r.driver_id, r.destination
  into v_driver_id, v_destination
  from public.rides_offered r
  where r.id = new.ride_id;

  if v_driver_id is null then
    return new;
  end if;

  select coalesce(nullif(trim(p.full_name), ''), 'A passenger')
  into v_requester_name
  from public.profiles p
  where p.id = new.requester_id;

  if new.activity_id is not null then
    select a.title into v_activity_title from public.activities a where a.id = new.activity_id;
  end if;

  insert into public.notifications (user_id, actor_id, activity_id, type, message)
  values (
    v_driver_id, new.requester_id, new.activity_id, 'ride_request',
    coalesce(v_requester_name, 'A passenger')
      || case when old.status = 'accepted'
           then ' cancelled their seat on your ride to '
           else ' withdrew their seat request for your ride to '
         end
      || coalesce(v_activity_title, v_destination, 'your destination') || '.'
  );

  return new;
end $$;

drop trigger if exists on_ride_request_cancelled on public.ride_requests;
create trigger on_ride_request_cancelled
  after update of status on public.ride_requests
  for each row execute function public.notify_on_ride_request_cancelled();

commit;
