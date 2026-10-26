-- Let hosts cancel an activity and keep the reason.

-- 1. Allow 'cancelled' as a status (replace the old active/expired check).
do $$
declare c text;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.activities'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table public.activities drop constraint %I', c);
  end loop;
end $$;

alter table public.activities
  add constraint activities_status_check
  check (status in ('active', 'expired', 'cancelled'));

-- 2. Store the host's message and when it was cancelled.
alter table public.activities add column if not exists cancel_reason text;
alter table public.activities add column if not exists cancelled_at timestamptz;

-- 3. Nobody can join a cancelled activity.
create or replace function public.block_rsvp_cancelled()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.activities
    where id = new.activity_id and status = 'cancelled'
  ) then
    raise exception 'This activity was cancelled.';
  end if;
  return new;
end;
$$;

drop trigger if exists block_rsvp_cancelled on public.rsvps;
create trigger block_rsvp_cancelled
  before insert on public.rsvps
  for each row execute function public.block_rsvp_cancelled();

-- 4. The cancel-activity edge function updates the activity.
grant update on public.activities to service_role;