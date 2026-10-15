-- Core email-login state. Run this migration before deploying the function/app.
create schema if not exists login_security;
revoke all on schema login_security from public, anon, authenticated;

create table login_security.sessions (
  session_id uuid primary key references auth.sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  challenge_id uuid,
  code_hash text,
  expires_at timestamptz,
  attempts integer not null default 0,
  verified_at timestamptz
);
create table login_security.sends (
  user_id uuid not null references auth.users(id) on delete cascade,
  sent_at timestamptz not null default now()
);
create index on login_security.sends(user_id, sent_at);
-- No client policies: only the owner-run verification functions access these rows.
alter table login_security.sessions enable row level security;
alter table login_security.sends enable row level security;
revoke all on all tables in schema login_security from public, anon, authenticated;

-- Preserve sessions already signed in at rollout, not future logins.
insert into login_security.sessions(session_id,user_id,email,verified_at)
select s.id,s.user_id,u.email,now() from auth.sessions s join auth.users u on u.id=s.user_id
where u.email is not null;

create function public.login_email_verified() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from login_security.sessions v
    join auth.sessions s on s.id=v.session_id and s.user_id=v.user_id
    join auth.users u on u.id=v.user_id
    where v.session_id::text=auth.jwt()->>'session_id' and v.user_id=auth.uid()
      and v.verified_at is not null and v.email=u.email
      and (s.not_after is null or s.not_after > now())
  );
$$;
revoke all on function public.login_email_verified() from public, anon;
grant execute on function public.login_email_verified() to authenticated, service_role;

create function public.begin_login_email(p_session uuid,p_user uuid,p_email text,p_challenge uuid,p_hash text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare last_send timestamptz; recent integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 0));
  if not exists(select 1 from auth.sessions s join auth.users u on u.id=s.user_id
    where s.id=p_session and s.user_id=p_user and u.email=p_email and u.email_confirmed_at is not null
    and (s.not_after is null or s.not_after>now())) then
    return jsonb_build_object('error','Sign in again.');
  end if;
  if exists(select 1 from login_security.sessions where session_id=p_session and email=p_email and verified_at is not null) then
    return jsonb_build_object('verified',true);
  end if;
  delete from login_security.sends where user_id=p_user and sent_at<now()-interval '1 day';
  select max(sent_at),count(*) into last_send,recent from login_security.sends where user_id=p_user;
  if last_send>now()-interval '60 seconds' then
    return jsonb_build_object('retryAfter',ceil(extract(epoch from last_send+interval '60 seconds'-now())),
      'challengeId',(select challenge_id from login_security.sessions where session_id=p_session and email=p_email));
  end if;
  if recent>=20 or (select count(*) from login_security.sends where user_id=p_user and sent_at>now()-interval '15 minutes')>=5 then
    return jsonb_build_object('error','Too many emails requested. Try again later.');
  end if;
  insert into login_security.sends(user_id) values(p_user);
  insert into login_security.sessions(session_id,user_id,email,challenge_id,code_hash,expires_at)
    values(p_session,p_user,p_email,p_challenge,p_hash,now()+interval '10 minutes')
    on conflict(session_id) do update set email=p_email,challenge_id=p_challenge,code_hash=p_hash,
      expires_at=now()+interval '10 minutes',attempts=0,verified_at=null;
  return jsonb_build_object('sent',true,'retryAfter',60);
end;
$$;

create function public.finish_login_email(p_session uuid,p_user uuid,p_email text,p_challenge uuid,p_hash text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v login_security.sessions%rowtype;
begin
  select * into v from login_security.sessions where session_id=p_session and user_id=p_user for update;
  if not found or v.email is distinct from p_email or v.verified_at is not null
    or v.challenge_id is distinct from p_challenge or p_challenge is null or p_hash is null
    or v.expires_at is null or v.expires_at<=now() or v.attempts>=5 then return false; end if;
  if not exists(select 1 from auth.sessions s join auth.users u on u.id=s.user_id
    where s.id=p_session and s.user_id=p_user and u.email=p_email and u.email_confirmed_at is not null
    and (s.not_after is null or s.not_after>now())) then return false; end if;
  update login_security.sessions set attempts=attempts+1 where session_id=p_session;
  if v.code_hash is distinct from p_hash then return false; end if;
  update login_security.sessions set verified_at=now(),code_hash=null,expires_at=null where session_id=p_session;
  return true;
end;
$$;
revoke all on function public.begin_login_email(uuid,uuid,text,uuid,text) from public,anon,authenticated;
revoke all on function public.finish_login_email(uuid,uuid,text,uuid,text) from public,anon,authenticated;
grant execute on function public.begin_login_email(uuid,uuid,text,uuid,text) to service_role;
grant execute on function public.finish_login_email(uuid,uuid,text,uuid,text) to service_role;
