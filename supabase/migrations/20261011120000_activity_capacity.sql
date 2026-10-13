begin;

create or replace function public.enforce_activity_capacity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  cap integer;
  taken integer;
begin
  select max_attendees into cap
  from activities where id = new.activity_id
  for update;

  if cap is null then return new; end if;

  select count(*) into taken
  from rsvps where activity_id = new.activity_id;

  if taken >= cap then
    raise exception 'This activity is full. Join the waitlist instead.';
  end if;

  return new;
end $$;

drop trigger if exists enforce_activity_capacity on public.rsvps;
create trigger enforce_activity_capacity
before insert on public.rsvps
for each row execute function public.enforce_activity_capacity();

commit;