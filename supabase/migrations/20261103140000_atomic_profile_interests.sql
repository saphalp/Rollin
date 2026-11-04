begin;

-- Function: set_profile_interests
-- Atomically updates the authenticated user's interests in a single transaction.
-- Guarantees that adding and removing interests succeeds or rolls back together.
create or replace function public.set_profile_interests(p_interest_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- 1. Remove interests belonging to the user that are NOT in the target array
  if p_interest_ids is null or array_length(p_interest_ids, 1) is null then
    delete from public.profile_interests
    where profile_id = v_user_id;
  else
    delete from public.profile_interests
    where profile_id = v_user_id
      and not (interest_id = any(p_interest_ids));

    -- 2. Insert new interests, ignoring any that are already present
    insert into public.profile_interests (profile_id, interest_id)
    select v_user_id, target_id
    from unnest(p_interest_ids) as target_id
    on conflict (profile_id, interest_id) do nothing;
  end if;
end;
$$;

revoke all on function public.set_profile_interests(uuid[]) from public;
grant execute on function public.set_profile_interests(uuid[]) to authenticated;

commit;
