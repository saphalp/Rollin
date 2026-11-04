-- Prevents duplicate ride requests and duplicate ride notifications.
-- Ensures passengers can only have one active (pending or accepted) request per ride,
-- and one active request per activity.

begin;

-- 1. Cancel older duplicate active ride requests for the same ride, keeping the latest one.
with ranked_ride_requests as (
  select id,
         row_number() over (
           partition by ride_id, requester_id
           order by created_at desc, id desc
         ) as rn
  from public.ride_requests
  where status in ('pending', 'accepted')
)
update public.ride_requests
set status = 'cancelled', updated_at = now()
where id in (
  select id from ranked_ride_requests where rn > 1
);

-- 2. Cancel older duplicate active ride requests for the same activity, keeping the latest one.
with ranked_activity_requests as (
  select id,
         row_number() over (
           partition by activity_id, requester_id
           order by created_at desc, id desc
         ) as rn
  from public.ride_requests
  where activity_id is not null
    and status in ('pending', 'accepted')
)
update public.ride_requests
set status = 'cancelled', updated_at = now()
where id in (
  select id from ranked_activity_requests where rn > 1
);

-- 3. Add unique partial indexes to guarantee no duplicate active ride requests can be created.
drop index if exists public.ride_requests_single_active_ride;
create unique index ride_requests_single_active_ride
  on public.ride_requests (ride_id, requester_id)
  where status in ('pending', 'accepted');

drop index if exists public.ride_requests_single_active_activity;
create unique index ride_requests_single_active_activity
  on public.ride_requests (activity_id, requester_id)
  where status in ('pending', 'accepted') and activity_id is not null;

-- 4. Clean up any existing duplicate notifications in public.notifications
with ranked_notifications as (
  select id,
         row_number() over (
           partition by user_id, actor_id, activity_id, type, message
           order by created_at desc, id desc
         ) as rn
  from public.notifications
)
delete from public.notifications
where id in (
  select id from ranked_notifications where rn > 1
);

commit;

