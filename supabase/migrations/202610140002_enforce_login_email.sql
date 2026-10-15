-- Activate only after deploying login-email and the updated user-facing Edge Functions.
-- Existing permissions/policies remain in place; this adds an additional requirement.
create function public.enforce_login_email() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.role()='authenticated'
     and trim(both '/' from coalesce(current_setting('request.path', true),'')) <> 'rpc/login_email_verified'
     and not public.login_email_verified() then
    raise sqlstate 'PT403' using message='Complete email login verification first.';
  end if;
end;
$$;
revoke all on function public.enforce_login_email() from public;
grant execute on function public.enforce_login_email() to anon,authenticated,service_role;

-- Do not silently replace an existing API pre-request hook.
do $$
declare existing text;
begin
  select split_part(setting,'=',2) into existing
  from pg_db_role_setting s cross join lateral unnest(s.setconfig) setting
  where s.setrole='authenticator'::regrole and setting like 'pgrst.db_pre_request=%'
  limit 1;
  if existing is not null and existing<>'' and existing<>'public.enforce_login_email' then
    raise exception 'Existing pre-request hook % must be combined with enforce_login_email before activation.', existing;
  end if;
end;
$$;
alter role authenticator set pgrst.db_pre_request='public.enforce_login_email';

-- REST pre-request checks do not run for Storage or Realtime: require verification in RLS too.
do $$
declare t record;
begin
  for t in select n.nspname,c.relname,c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where c.relkind in ('r','p') and (n.nspname='public' or (n.nspname='storage' and c.relname='objects') or (n.nspname='realtime' and c.relname='messages'))
  loop
    if not t.relrowsecurity then
      -- Previously grants alone controlled this table. Preserve that baseline under RLS.
      execute format('alter table %I.%I enable row level security',t.nspname,t.relname);
      execute format('create policy login_existing_grants on %I.%I for all to anon,authenticated using (true) with check (true)',t.nspname,t.relname);
    end if;
    execute format('create policy require_login_email on %I.%I as restrictive for all to authenticated using ((select public.login_email_verified())) with check ((select public.login_email_verified()))',t.nspname,t.relname);
  end loop;
end;
$$;
notify pgrst,'reload config';
notify pgrst,'reload schema';
