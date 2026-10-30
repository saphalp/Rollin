begin;

-- Additional SELECT restrictions, never replacements for existing access rules.
-- Requires the existing account privacy and login-email verification functions.
alter table public.activity_photos enable row level security;
alter table public.activity_photo_images enable row level security;
alter table public.post_likes enable row level security;

drop policy if exists activity_post_visibility on public.activity_photos;
create policy activity_post_visibility on public.activity_photos
  as restrictive for select to public using (
    auth.uid() is not null and public.login_email_verified()
    and public.rollin_account_active(auth.uid())
    and public.rollin_account_active(activity_photos.user_id)
    and exists (
      select 1 from public.activities a where a.id = activity_photos.activity_id
      and public.rollin_account_active(a.host_id)
      and (a.event_type = 'public' or a.host_id = auth.uid() or exists (
        select 1 from public.rsvps r where r.activity_id = a.id and r.user_id = auth.uid()
      ))
      and (activity_photos.user_id = auth.uid() or (
        public.rollin_can_view_profile(a.host_id)
        and public.rollin_can_view_profile(activity_photos.user_id)
      ))
    )
  );

drop policy if exists activity_post_image_visibility on public.activity_photo_images;
create policy activity_post_image_visibility on public.activity_photo_images
  as restrictive for select to public using (
    exists (select 1 from public.activity_photos p where p.id = activity_photo_images.post_id)
  );
drop policy if exists activity_post_like_visibility on public.post_likes;
create policy activity_post_like_visibility on public.post_likes
  as restrictive for select to public using (
    exists (select 1 from public.activity_photos p where p.id = post_likes.post_id)
  );

create index if not exists activity_photos_activity_order_idx
  on public.activity_photos(activity_id, created_at desc, id desc);

-- One authorized snapshot of the post, author, ordered images and likes.
-- Invoker permissions preserve all table RLS, including future restrictions.
create or replace function public.get_activity_explore_posts(
  p_activity_id uuid default null,
  p_post_id uuid default null,
  p_before_created_at timestamptz default null,
  p_before_id uuid default null,
  p_limit integer default 7
)
returns table (
  id uuid, activity_id uuid, user_id uuid, caption text, created_at timestamptz,
  author_name text, avatar_path text, image_paths text[], like_count bigint, liked_by_me boolean
)
language sql stable security invoker set search_path = '' as $$
  select p.id, p.activity_id, p.user_id, p.caption, p.created_at,
    pr.full_name, pr.profile_picture,
    coalesce(
      (select array_agg(i.image_path order by i.position, i.id)
       from public.activity_photo_images i where i.post_id = p.id),
      case when p.image_path is not null then array[p.image_path] else array[]::text[] end
    ),
    (select count(*) from public.post_likes l where l.post_id = p.id),
    exists(select 1 from public.post_likes l where l.post_id = p.id and l.user_id = auth.uid())
  from public.activity_photos p join public.profiles pr on pr.id = p.user_id
  where auth.uid() is not null and public.login_email_verified()
    and (p_activity_id is not null or p_post_id is not null)
    and (p_activity_id is null or p.activity_id = p_activity_id)
    and (p_post_id is null or p.id = p_post_id)
    and (p_before_created_at is null or (p.created_at, p.id) < (p_before_created_at, p_before_id))
  order by p.created_at desc, p.id desc
  limit greatest(1, least(coalesce(p_limit, 7), 21));
$$;
revoke all on function public.get_activity_explore_posts(uuid,uuid,timestamptz,uuid,integer) from public, anon;
grant execute on function public.get_activity_explore_posts(uuid,uuid,timestamptz,uuid,integer) to authenticated;

commit;
