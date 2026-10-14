begin;

-- 1:1 with profiles: vehicle + plate info collected during onboarding (optional)
-- or later via Edit Profile. No verification logic yet — verification_status is
-- a placeholder column for a future third-party integration.
create table if not exists public.driver_profiles (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  vehicle_make text not null check (char_length(btrim(vehicle_make)) between 1 and 60),
  vehicle_model text not null check (char_length(btrim(vehicle_model)) between 1 and 60),
  vehicle_year integer not null check (vehicle_year between 1900 and extract(year from now())::int + 1),
  vehicle_color text not null check (char_length(btrim(vehicle_color)) between 1 and 40),
  license_plate_number text not null check (char_length(btrim(license_plate_number)) between 1 and 15),
  verification_status text not null default 'unverified'
    check (verification_status in ('unverified', 'pending', 'verified', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.driver_profiles enable row level security;
revoke all on public.driver_profiles from anon, authenticated;
grant select, insert, update on public.driver_profiles to authenticated;

create policy "Drivers can read their own driver profile" on public.driver_profiles
for select to authenticated using (auth.uid() = profile_id);

create policy "Drivers can insert their own driver profile" on public.driver_profiles
for insert to authenticated with check (auth.uid() = profile_id);

create policy "Drivers can update their own driver profile" on public.driver_profiles
for update to authenticated using (auth.uid() = profile_id) with check (auth.uid() = profile_id);

-- Cheap "is this profile a driver" flag, kept in sync by trigger (not app code)
-- so it can never drift even if a row is written through another path.
alter table public.profiles add column if not exists is_driver boolean not null default false;

create or replace function public.sync_profile_is_driver() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.profiles set is_driver = true where id = new.profile_id;
  elsif tg_op = 'DELETE' then
    update public.profiles set is_driver = false where id = old.profile_id;
  end if;
  return null;
end $$;

drop trigger if exists sync_profile_is_driver on public.driver_profiles;
create trigger sync_profile_is_driver after insert or delete on public.driver_profiles
for each row execute function public.sync_profile_is_driver();

notify pgrst, 'reload schema';
commit;
