begin;

-- Attendees review the host of an activity they went to. Ride ratings stay in ride_ratings.
create table if not exists public.host_reviews (
  activity_id uuid not null references public.activities(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  host_id uuid not null references public.profiles(id) on delete cascade,
  stars integer not null check (stars between 1 and 5),
  comment text not null default '' check (length(comment) <= 1000),
  updated_at timestamptz not null default now(),
  primary key (activity_id, author_id),
  check (author_id <> host_id)
);
create index if not exists host_reviews_host_idx on public.host_reviews (host_id);
alter table public.host_reviews enable row level security;
revoke all on public.host_reviews from anon, authenticated;
grant select on public.host_reviews to authenticated;
drop policy if exists "Read own written or received host reviews" on public.host_reviews;
create policy "Read own written or received host reviews" on public.host_reviews for select to authenticated
using (auth.uid() = author_id or auth.uid() = host_id);

-- "Attended" means an RSVP to an activity whose start time has passed; there is no check-in.
create or replace function public.save_host_review(p_activity_id uuid, p_stars integer, p_comment text)
returns void language plpgsql security definer set search_path = public as $$
declare host uuid;
begin
  select host_id into host from public.activities where id = p_activity_id and date_time < now();
  if auth.uid() is null or host is null or host = auth.uid() or not exists (
    select 1 from public.rsvps where activity_id = p_activity_id and user_id = auth.uid()
  ) then raise exception 'Only attendees of a past activity can review its host'; end if;
  insert into public.host_reviews values (p_activity_id, auth.uid(), host, p_stars, coalesce(trim(p_comment), ''), now())
  on conflict (activity_id, author_id) do update
  set stars = excluded.stars, comment = excluded.comment, updated_at = now();
end $$;

-- Reviews are public: anyone signed in can read who reviewed a user, for what, and what they said.
create or replace function public.profile_reviews(p_user_id uuid)
returns table (kind text, item_id uuid, item_title text, item_date timestamptz, author_id uuid,
  author_name text, author_picture text, stars integer, comment text, updated_at timestamptz)
language sql stable security definer set search_path = public as $$
  select * from (
    select 'ride'::text, r.id, coalesce(r.destination, 'Ride'), r.date_time, x.author_id,
      coalesce(p.full_name, 'Rollin user'), p.profile_picture, x.stars, x.comment, x.updated_at
    from public.ride_ratings x join public.rides_offered r on r.id = x.ride_id
    join public.profiles p on p.id = x.author_id
    where x.recipient_id = p_user_id
    union all
    select 'host'::text, a.id, a.title, a.date_time, h.author_id,
      coalesce(p.full_name, 'Rollin user'), p.profile_picture, h.stars, h.comment, h.updated_at
    from public.host_reviews h join public.activities a on a.id = h.activity_id
    join public.profiles p on p.id = h.author_id
    where h.host_id = p_user_id
  ) reviews order by 10 desc;
$$;

create or replace function public.review_summary(p_user_id uuid)
returns table (average numeric, count bigint) language sql stable security definer set search_path = public as $$
  select round(avg(stars), 1), count(*) from (
    select stars from public.ride_ratings where recipient_id = p_user_id
    union all
    select stars from public.host_reviews where host_id = p_user_id
  ) all_reviews;
$$;

-- Everything the caller can review this user for, including items they already reviewed so they can edit them.
create or replace function public.review_targets(p_subject_id uuid)
returns table (kind text, item_id uuid, title text, item_date timestamptz, my_stars integer, my_comment text)
language sql stable security definer set search_path = public as $$
  select * from (
    select 'ride'::text, r.id, coalesce(r.destination, 'Ride'), r.date_time, x.stars, x.comment
    from public.rides_offered r
    left join public.ride_ratings x on x.ride_id = r.id and x.author_id = auth.uid() and x.recipient_id = p_subject_id
    where r.status = 'completed' and p_subject_id <> auth.uid() and exists (
      select 1 from public.ride_requests q where q.ride_id = r.id and q.status in ('accepted','completed')
        and ((auth.uid() = r.driver_id and q.requester_id = p_subject_id)
          or (p_subject_id = r.driver_id and q.requester_id = auth.uid())))
    union all
    select 'host'::text, a.id, a.title, a.date_time, h.stars, h.comment
    from public.activities a
    left join public.host_reviews h on h.activity_id = a.id and h.author_id = auth.uid()
    where a.host_id = p_subject_id and a.host_id <> auth.uid() and a.date_time < now()
      and exists (select 1 from public.rsvps v where v.activity_id = a.id and v.user_id = auth.uid())
  ) targets order by 4 desc nulls last;
$$;

revoke all on function public.save_host_review(uuid,integer,text), public.profile_reviews(uuid),
 public.review_summary(uuid), public.review_targets(uuid) from public;
grant execute on function public.save_host_review(uuid,integer,text), public.profile_reviews(uuid),
 public.review_summary(uuid), public.review_targets(uuid) to authenticated;
notify pgrst, 'reload schema';
commit;
