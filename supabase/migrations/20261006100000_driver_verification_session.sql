begin;

-- Added after the initial driver_profiles table was created: vehicle year
-- (collected alongside make/model) and the Didit verification session id.
alter table public.driver_profiles
  add column if not exists vehicle_year integer
    check (vehicle_year between 1900 and extract(year from now())::int + 1);

alter table public.driver_profiles
  add column if not exists verification_session_id text;

notify pgrst, 'reload schema';
commit;
