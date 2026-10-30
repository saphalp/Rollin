-- On/off switch for the emailed login code (see docs/features/login-email-verification.md).
--   require_login_code = true  -> every new session must enter the emailed code (default, current behavior)
--   require_login_code = false -> email/password (or Google) sign-in is enough
-- Switch it in the SQL editor:
--   update login_security.settings set require_login_code = false;
-- The app needs no release: it asks the server whether this login is approved, so the
-- code screen appears or disappears on the next sign-in or app relaunch.
begin;

create table if not exists login_security.settings (
  id boolean primary key default true check (id), -- single-row table
  require_login_code boolean not null default true
);
alter table login_security.settings enable row level security;
revoke all on login_security.settings from public, anon, authenticated;
insert into login_security.settings (id) values (true) on conflict (id) do nothing;

-- Same signature, so existing policies, the pre-request check and Edge Functions keep calling it.
-- With the code switched off, a session is approved as long as it is still a live Auth session.
create or replace function public.login_email_verified() returns boolean
language sql stable security definer set search_path = '' as $$
  select case
    when not coalesce((select require_login_code from login_security.settings where id), true) then exists (
      select 1 from auth.sessions s
      where s.id::text = auth.jwt()->>'session_id' and s.user_id = auth.uid()
        and (s.not_after is null or s.not_after > now())
    )
    else exists (
      select 1 from login_security.sessions v
      join auth.sessions s on s.id=v.session_id and s.user_id=v.user_id
      join auth.users u on u.id=v.user_id
      where v.session_id::text=auth.jwt()->>'session_id' and v.user_id=auth.uid()
        and v.verified_at is not null and v.email=u.email
        and (s.not_after is null or s.not_after > now())
    )
  end;
$$;
revoke all on function public.login_email_verified() from public, anon;
grant execute on function public.login_email_verified() to authenticated, service_role;

commit;
