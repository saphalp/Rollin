begin;

-- One table for every kind of report (user, activity, explore post) so the Rollin Analytics app can run a
-- single moderation queue. target_id is polymorphic (no FK), so submit_report validates it and captures a
-- snapshot of the content: reported posts/activities are often deleted before anyone reviews them.
do $$ begin
  create type public.report_target_type as enum ('user', 'activity', 'post');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.report_reason as enum (
    'spam', 'harassment', 'hate_speech', 'nudity', 'violence',
    'false_information', 'impersonation', 'scam', 'other'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.report_status as enum ('pending', 'reviewing', 'resolved', 'dismissed');
exception when duplicate_object then null; end $$;

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  -- Kept when the reporter deletes their account so the moderation history survives.
  reporter_id uuid references public.profiles(id) on delete set null,
  target_type public.report_target_type not null,
  target_id uuid not null,
  -- The person responsible for the target (the user, the activity host, or the post author),
  -- so moderators can see every report against someone regardless of what was reported.
  reported_user_id uuid references public.profiles(id) on delete set null,
  reason public.report_reason not null,
  details text check (details is null or length(details) <= 1000),
  target_snapshot jsonb not null default '{}'::jsonb,
  status public.report_status not null default 'pending',
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  resolution_note text,
  created_at timestamptz not null default now(),
  check (reporter_id is null or reported_user_id is null or reporter_id <> reported_user_id)
);

-- A reporter can only have one open report per target; once it's resolved they can report again.
create unique index if not exists reports_one_open_per_reporter_idx
  on public.reports (reporter_id, target_type, target_id)
  where status in ('pending', 'reviewing');
create index if not exists reports_queue_idx on public.reports (status, created_at desc);
create index if not exists reports_target_idx on public.reports (target_type, target_id);
create index if not exists reports_reported_user_idx on public.reports (reported_user_id);

-- No direct client access: inserts go through submit_report, and the analytics app reads with the
-- service-role key (which bypasses RLS). Add a moderator policy here if that app ever signs in as a user.
alter table public.reports enable row level security;
revoke all on public.reports from anon, authenticated;

create or replace function public.submit_report(
  p_target_type public.report_target_type,
  p_target_id uuid,
  p_reason public.report_reason,
  p_details text default null
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  owner uuid;
  snapshot jsonb;
  report_id uuid;
  clean_details text := nullif(trim(coalesce(p_details, '')), '');
begin
  if auth.uid() is null then raise exception 'Sign in to submit a report'; end if;

  if p_target_type = 'user' then
    select p.id, jsonb_build_object('full_name', p.full_name, 'profile_picture', p.profile_picture,
      'university', p.university)
    into owner, snapshot from public.profiles p where p.id = p_target_id;
  elsif p_target_type = 'activity' then
    select a.host_id, jsonb_build_object('title', a.title, 'image_url', a.image_url, 'date_time', a.date_time)
    into owner, snapshot from public.activities a where a.id = p_target_id;
  else
    select ph.user_id, jsonb_build_object('caption', ph.caption, 'activity_id', ph.activity_id,
      'image_paths', coalesce(
        (select jsonb_agg(i.image_path order by i.position) from public.activity_photo_images i where i.post_id = ph.id),
        jsonb_build_array(ph.image_path)))
    into owner, snapshot from public.activity_photos ph where ph.id = p_target_id;
  end if;

  if owner is null then raise exception 'That content no longer exists'; end if;
  if owner = auth.uid() then raise exception 'You cannot report your own content'; end if;

  insert into public.reports (reporter_id, target_type, target_id, reported_user_id, reason, details, target_snapshot)
  values (auth.uid(), p_target_type, p_target_id, owner, p_reason, left(clean_details, 1000), snapshot)
  on conflict (reporter_id, target_type, target_id) where status in ('pending', 'reviewing') do nothing
  returning id into report_id;

  -- Re-reporting something already in the queue is a no-op rather than an error.
  if report_id is null then
    select r.id into report_id from public.reports r
    where r.reporter_id = auth.uid() and r.target_type = p_target_type and r.target_id = p_target_id
      and r.status in ('pending', 'reviewing');
  end if;

  return report_id;
end $$;

-- Per-target rollup for the analytics app's queue (most-reported first). Service role only.
create or replace view public.report_target_summary with (security_invoker = true) as
  select target_type, target_id, reported_user_id,
    count(*) as report_count,
    count(*) filter (where status in ('pending', 'reviewing')) as open_count,
    array_agg(distinct reason) as reasons,
    min(created_at) as first_reported_at,
    max(created_at) as last_reported_at
  from public.reports
  group by target_type, target_id, reported_user_id;
revoke all on public.report_target_summary from anon, authenticated;

revoke all on function public.submit_report(public.report_target_type, uuid, public.report_reason, text) from public;
grant execute on function public.submit_report(public.report_target_type, uuid, public.report_reason, text) to authenticated;
notify pgrst, 'reload schema';
commit;
