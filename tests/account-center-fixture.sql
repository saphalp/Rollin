begin;
create table if not exists public.account_settings (
 user_id uuid primary key references auth.users(id) on delete cascade,
 show_social_links boolean not null default true,
 deactivated_at timestamptz,
 deletion_started_at timestamptz,
 updated_at timestamptz not null default now()
);
create table if not exists public.profile_social_links (
 user_id uuid not null references public.profiles(id) on delete cascade,
 platform text not null check(platform in ('instagram','linkedin','facebook')),
 url text not null check(length(url)<=512),
 primary key(user_id,platform),
 constraint social_url_host check(
  (platform='instagram' and url ~ '^https://(www\.)?instagram\.com/[A-Za-z0-9_.-]+/?$') or
  (platform='linkedin' and url ~ '^https://(www\.)?linkedin\.com/(in|company)/[A-Za-z0-9_%.-]+/?$') or
  (platform='facebook' and url ~ '^https://(www\.)?facebook\.com/[A-Za-z0-9_.-]+/?$')
 )
);
alter table public.account_settings enable row level security;
alter table public.profile_social_links enable row level security;
revoke all on public.account_settings, public.profile_social_links from anon,authenticated;
grant select on public.account_settings to authenticated;
grant select,insert,update,delete on public.profile_social_links to authenticated;
grant all on public.account_settings,public.profile_social_links to service_role;

-- Security-definer helpers avoid recursive policies and never trust user metadata.
create or replace function public.rollin_account_active(target_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.users u where u.id=target_id)
 and not exists(select 1 from public.account_settings s where s.user_id=target_id
   and (s.deactivated_at is not null or s.deletion_started_at is not null));
$$;
create or replace function public.rollin_session_active()
returns boolean language sql stable security definer set search_path='' as $$
 select (select auth.uid()) is null or public.rollin_account_active((select auth.uid()));
$$;
create or replace function public.rollin_can_view_profile(target_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select (select auth.uid()) is not null and exists(select 1 from auth.users u where u.id=(select auth.uid()))
 and exists(select 1 from public.profiles p where p.id=target_id and (
  p.id=(select auth.uid()) or (public.rollin_account_active((select auth.uid())) and public.rollin_account_active(p.id)
   and (not coalesce(p.is_private,false) or exists(
    select 1 from public.follows f where f.following_id=p.id and f.follower_id=(select auth.uid()) and f.status::text='accepted'
   )))
 ));
$$;
create or replace function public.rollin_can_view_social(target_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select public.rollin_can_view_profile(target_id) and (
  target_id=(select auth.uid()) or coalesce((select s.show_social_links from public.account_settings s where s.user_id=target_id),true)
 );
$$;
revoke all on function public.rollin_account_active(uuid),public.rollin_session_active(),public.rollin_can_view_profile(uuid),public.rollin_can_view_social(uuid) from public;
grant execute on function public.rollin_account_active(uuid),public.rollin_session_active(),public.rollin_can_view_profile(uuid),public.rollin_can_view_social(uuid) to anon,authenticated,service_role;

drop policy if exists account_settings_own on public.account_settings;
create policy account_settings_own on public.account_settings for select to authenticated using(user_id=(select auth.uid()));
drop policy if exists social_links_read on public.profile_social_links;
create policy social_links_read on public.profile_social_links for select to authenticated using(public.rollin_can_view_social(user_id));
drop policy if exists social_links_own on public.profile_social_links;
create policy social_links_own on public.profile_social_links for all to authenticated
using(user_id=(select auth.uid()) and public.rollin_account_active((select auth.uid())))
with check(user_id=(select auth.uid()) and public.rollin_account_active((select auth.uid())));
-- An ALL owner policy must not accidentally grant hidden links to others.

-- A follower must not grant themselves access by inserting status='accepted'.
create or replace function public.rollin_valid_follow_insert(target_id uuid,requested_status text)
returns boolean language sql stable security definer set search_path='' as $$
 select public.rollin_account_active((select auth.uid())) and public.rollin_account_active(target_id)
 and exists(select 1 from public.profiles p where p.id=target_id and (
  requested_status='pending' or (requested_status='accepted' and not coalesce(p.is_private,false))
 ));
$$;
revoke all on function public.rollin_valid_follow_insert(uuid,text) from public;
grant execute on function public.rollin_valid_follow_insert(uuid,text) to authenticated;
drop policy if exists rollin_follow_status_guard on public.follows;
create policy rollin_follow_status_guard on public.follows as restrictive for insert to authenticated
with check(follower_id=(select auth.uid()) and public.rollin_valid_follow_insert(following_id,status::text));

-- Add restrictive policies, preserving existing permissive rules.
-- This is essential: an existing SELECT USING(true) would otherwise bypass privacy.
drop policy if exists rollin_profile_visibility on public.profiles;
create policy rollin_profile_visibility on public.profiles as restrictive for select to public
using(public.rollin_can_view_profile(id));
drop policy if exists rollin_interest_visibility on public.profile_interests;
create policy rollin_interest_visibility on public.profile_interests as restrictive for select to public
using(public.rollin_can_view_profile(profile_id));

-- Block normal reads/writes from deactivated/deleting accounts and stale deleted-user JWTs.
-- Account settings remain readable so an owner can explicitly reactivate/retry deletion.
do $$ declare t record; begin
 for t in select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relkind='r' and c.relrowsecurity
 and c.relname not in ('profiles','account_settings','universities','university_email_domains','university_event_sources','interests')
 loop
  execute format('drop policy if exists rollin_active_session on public.%I',t.relname);
  execute format('create policy rollin_active_session on public.%I as restrictive for all to authenticated using ((select public.rollin_session_active())) with check ((select public.rollin_session_active()))',t.relname);
 end loop;
end $$;

-- Keep an inactive owner's own profile readable for the existing Auth provider.
-- Other profile reads are still controlled by rollin_profile_visibility.
drop policy if exists rollin_active_session on public.profiles;
drop policy if exists rollin_active_profile_insert on public.profiles;
create policy rollin_active_profile_insert on public.profiles as restrictive for insert to authenticated with check((select public.rollin_session_active()));
drop policy if exists rollin_active_profile_update on public.profiles;
create policy rollin_active_profile_update on public.profiles as restrictive for update to authenticated using((select public.rollin_session_active())) with check((select public.rollin_session_active()));
drop policy if exists rollin_active_profile_delete on public.profiles;
create policy rollin_active_profile_delete on public.profiles as restrictive for delete to authenticated using((select public.rollin_session_active()));

-- Hide an inactive owner's content from everyone, while retaining it for reactivation.
drop policy if exists rollin_active_host on public.activities;
create policy rollin_active_host on public.activities as restrictive for select to public using(host_id is null or public.rollin_account_active(host_id));
drop policy if exists rollin_active_driver on public.rides_offered;
create policy rollin_active_driver on public.rides_offered as restrictive for select to public using(driver_id is null or public.rollin_account_active(driver_id));
drop policy if exists rollin_active_requester on public.ride_wanted_requests;
create policy rollin_active_requester on public.ride_wanted_requests as restrictive for select to public using(public.rollin_account_active(requester_id));
drop policy if exists rollin_active_photo_author on public.activity_photos;
create policy rollin_active_photo_author on public.activity_photos as restrictive for select to public using(public.rollin_account_active(user_id));
drop policy if exists rollin_active_photo_image on public.activity_photo_images;
create policy rollin_active_photo_image on public.activity_photo_images as restrictive for select to public using(public.rollin_account_active(user_id));
-- Public file URLs already shared remain accessible; buckets are not made private here.
drop policy if exists rollin_active_uploads on storage.objects;
create policy rollin_active_uploads on storage.objects as restrictive for insert to authenticated with check((select public.rollin_session_active()));
drop policy if exists rollin_active_file_updates on storage.objects;
create policy rollin_active_file_updates on storage.objects as restrictive for update to authenticated using((select public.rollin_session_active())) with check((select public.rollin_session_active()));
drop policy if exists rollin_active_file_deletes on storage.objects;
create policy rollin_active_file_deletes on storage.objects as restrictive for delete to authenticated using((select public.rollin_session_active()));

create or replace function public.rollin_my_account()
returns table(user_id uuid,email text,is_private boolean,show_social_links boolean,deactivated boolean,deleting boolean)
language sql stable security definer set search_path='' as $$
 select u.id,u.email,coalesce(p.is_private,false),coalesce(s.show_social_links,true),s.deactivated_at is not null,s.deletion_started_at is not null
 from auth.users u left join public.profiles p on p.id=u.id left join public.account_settings s on s.user_id=u.id
 where u.id=(select auth.uid());
$$;
create or replace function public.rollin_update_privacy(private_profile boolean,visible_social boolean,expected_user_id uuid)
returns void language plpgsql security definer set search_path='' as $$
 declare actor uuid:=(select auth.uid()); begin
 if actor is distinct from expected_user_id then raise exception 'Account changed; reload before saving';end if;
 if not public.rollin_account_active(actor) then raise exception 'Account is not active';end if;
 if private_profile is null or visible_social is null then raise exception 'Both settings are required';end if;
 update public.profiles set is_private=private_profile where id=actor;
 if not found then raise exception 'Complete your profile first';end if;
 insert into public.account_settings(user_id,show_social_links) values(actor,visible_social)
 on conflict(user_id) do update set show_social_links=excluded.show_social_links,updated_at=now();
 end;
$$;
create or replace function public.rollin_has_ongoing_ride(target_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.rides_offered r where r.driver_id=target_id and r.status='in_progress')
 or exists(select 1 from public.ride_requests q join public.rides_offered r on r.id=q.ride_id
 where q.requester_id=target_id and q.status='accepted' and r.status='in_progress');
$$;
revoke all on function public.rollin_has_ongoing_ride(uuid) from public;
create or replace function public.rollin_set_deactivated(deactivate boolean,expected_user_id uuid)
returns void language plpgsql security definer set search_path='' as $$
 declare actor uuid:=(select auth.uid()); begin
 if actor is distinct from expected_user_id then raise exception 'Account changed; reload before saving';end if;
 if actor is null or not exists(select 1 from auth.users u where u.id=actor) then raise exception 'Sign in first';end if;
 if deactivate is null then raise exception 'Choose an account state';end if;
 insert into public.account_settings(user_id) values(actor) on conflict do nothing;
 perform 1 from public.account_settings where user_id=actor for update;
 if exists(select 1 from public.account_settings s where s.user_id=actor and s.deletion_started_at is not null) then raise exception 'Deletion has started; retry deletion';end if;
 if deactivate and public.rollin_has_ongoing_ride(actor) then raise exception 'Finish your ongoing ride before deactivating';end if;
 update public.account_settings set deactivated_at=case when deactivate then now() else null end,updated_at=now() where user_id=actor;
 end;
$$;
-- Minimal identity lets people request access to a private profile without exposing its full row/email.
create or replace function public.rollin_profile_access(target_id uuid)
returns table(id uuid,full_name text,profile_picture text,is_private boolean,can_view boolean)
language sql stable security definer set search_path='' as $$
 select p.id,p.full_name,p.profile_picture,coalesce(p.is_private,false),public.rollin_can_view_profile(p.id)
 from public.profiles p where p.id=target_id and public.rollin_account_active(p.id)
 and (select auth.uid()) is not null and public.rollin_account_active((select auth.uid()));
$$;
revoke all on function public.rollin_my_account(),public.rollin_update_privacy(boolean,boolean,uuid),public.rollin_set_deactivated(boolean,uuid),public.rollin_profile_access(uuid) from public,anon;
grant execute on function public.rollin_my_account(),public.rollin_update_privacy(boolean,boolean,uuid),public.rollin_set_deactivated(boolean,uuid),public.rollin_profile_access(uuid) to authenticated;

-- Backend only. Mobile clients cannot choose an arbitrary account to delete.
create or replace function public.rollin_begin_delete(target_id uuid)
returns void language plpgsql security definer set search_path='' as $$
 begin
 if not exists(select 1 from auth.users u where u.id=target_id) then raise exception 'Account not found';end if;
 insert into public.account_settings(user_id) values(target_id) on conflict do nothing;
 perform 1 from public.account_settings where user_id=target_id for update;
 if public.rollin_has_ongoing_ride(target_id) then raise exception 'Finish your ongoing ride before deleting';end if;
 update public.account_settings set deletion_started_at=coalesce(deletion_started_at,now()),updated_at=now() where user_id=target_id;
 end;
$$;
-- Always fetch the first batch: the Storage API removes metadata, so OFFSET would skip files.
create or replace function public.rollin_delete_files(target_id uuid,project_url text)
returns table(bucket_id text,name text)
language sql stable security definer set search_path='' as $$
 select o.bucket_id,o.name from storage.objects o
 where exists(select 1 from public.account_settings s where s.user_id=target_id and s.deletion_started_at is not null)
 and (
  (to_jsonb(o)->>'owner_id')=target_id::text or (to_jsonb(o)->>'owner')=target_id::text
  or ((split_part(o.name,'/',1)=target_id::text) and o.bucket_id in ('avatars','activity-images','activity-photos')
    and coalesce(to_jsonb(o)->>'owner_id',to_jsonb(o)->>'owner','') in ('',target_id::text))
  or (o.bucket_id='avatars' and exists(select 1 from public.profiles p where p.id=target_id
   and (p.profile_picture=o.name or p.profile_picture=rtrim(project_url,'/')||'/storage/v1/object/public/avatars/'||o.name))
   and coalesce(to_jsonb(o)->>'owner_id',to_jsonb(o)->>'owner','') in ('',target_id::text))
  or (o.bucket_id='activity-images' and exists(select 1 from public.activities a where a.host_id=target_id
   and (a.image_url=o.name or a.image_url=rtrim(project_url,'/')||'/storage/v1/object/public/activity-images/'||o.name))
   and coalesce(to_jsonb(o)->>'owner_id',to_jsonb(o)->>'owner','') in ('',target_id::text))
  or (o.bucket_id='activity-photos' and exists(select 1 from public.activity_photos p left join public.activities a on a.id=p.activity_id
    where (p.user_id=target_id or a.host_id=target_id) and p.image_path=o.name))
  or (o.bucket_id='activity-photos' and exists(select 1 from public.activity_photo_images i join public.activity_photos p on p.id=i.post_id
    left join public.activities a on a.id=p.activity_id where (p.user_id=target_id or a.host_id=target_id) and i.image_path=o.name))
 ) order by o.bucket_id,o.name limit 200;
$$;
revoke all on function public.rollin_begin_delete(uuid),public.rollin_delete_files(uuid,text) from public,anon,authenticated;
grant execute on function public.rollin_begin_delete(uuid),public.rollin_delete_files(uuid,text) to service_role;
notify pgrst,'reload schema';
commit;
