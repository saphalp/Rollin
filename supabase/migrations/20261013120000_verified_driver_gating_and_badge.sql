begin;

-- Only drivers with a verified license may offer rides. Enforced at the
-- database level (not just in the app) so a buggy or modified client can't
-- bypass it.
create or replace function public.require_verified_driver_for_ride_offer() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from public.driver_profiles
    where profile_id = new.driver_id and verification_status = 'verified'
  ) then
    raise exception 'Only drivers with a verified license can offer rides';
  end if;
  return new;
end $$;

drop trigger if exists require_verified_driver_for_ride_offer on public.rides_offered;
create trigger require_verified_driver_for_ride_offer before insert on public.rides_offered
for each row execute function public.require_verified_driver_for_ride_offer();

-- Cheap "is this profile a verified driver" flag, kept in sync by trigger
-- (not app code), the same way profiles.is_driver already works — lets any
-- profile screen show a "Verified Driver" badge without an extra query or a
-- new RLS policy exposing other users' driver_profiles rows.
alter table public.profiles add column if not exists is_verified_driver boolean not null default false;

create or replace function public.sync_profile_is_verified_driver() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    update public.profiles set is_verified_driver = false where id = old.profile_id;
    return null;
  end if;
  update public.profiles set is_verified_driver = (new.verification_status = 'verified') where id = new.profile_id;
  return null;
end $$;

drop trigger if exists sync_profile_is_verified_driver on public.driver_profiles;
create trigger sync_profile_is_verified_driver after insert or update of verification_status or delete on public.driver_profiles
for each row execute function public.sync_profile_is_verified_driver();

notify pgrst, 'reload schema';
commit;
