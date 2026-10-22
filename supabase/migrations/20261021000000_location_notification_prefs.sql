begin;

alter table public.notification_settings
  add column if not exists nearby_activities_enabled boolean not null default false,
  add column if not exists nearby_activities_radius_miles integer not null default 5
    check (nearby_activities_radius_miles in (1, 5, 10)),
  add column if not exists user_latitude double precision,
  add column if not exists user_longitude double precision;

-- Helper: check if a point (act_lat, act_lng) is within radius_miles of (user_lat, user_lng)
-- Uses the Haversine approximation (good enough for <=10 mi)
create or replace function public.activity_within_radius(
  user_lat double precision,
  user_lng double precision,
  act_lat  double precision,
  act_lng  double precision,
  radius_miles integer
) returns boolean
language sql
immutable
as $$
  select (
    3958.8 * acos(
      least(1.0,
        cos(radians(user_lat)) * cos(radians(act_lat))
        * cos(radians(act_lng) - radians(user_lng))
        + sin(radians(user_lat)) * sin(radians(act_lat))
      )
    )
  ) <= radius_miles;
$$;

commit;
