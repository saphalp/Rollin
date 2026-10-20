begin;

-- Reviews are final: one per activity, and one per ride participant. Saving again is rejected instead of editing.
create or replace function public.save_host_review(p_activity_id uuid, p_stars integer, p_comment text)
returns void language plpgsql security definer set search_path = public as $$
declare host uuid;
begin
  select host_id into host from public.activities where id = p_activity_id and date_time < now();
  if auth.uid() is null or host is null or host = auth.uid() or not exists (
    select 1 from public.rsvps where activity_id = p_activity_id and user_id = auth.uid()
  ) then raise exception 'Only attendees of a past activity can review its host'; end if;
  insert into public.host_reviews values (p_activity_id, auth.uid(), host, p_stars, coalesce(trim(p_comment), ''), now())
  on conflict (activity_id, author_id) do nothing;
  if not found then raise exception 'You already reviewed this activity'; end if;
end $$;

create or replace function public.save_ride_rating(p_ride_id uuid, p_recipient_id uuid, p_stars integer, p_comment text)
returns void language plpgsql security definer set search_path = public as $$
declare driver uuid;
begin
  select driver_id into driver from public.rides_offered where id = p_ride_id and status = 'completed';
  if auth.uid() is null or driver is null or p_recipient_id = auth.uid() or not exists (
    select 1 from public.ride_requests q where q.ride_id = p_ride_id and q.status in ('accepted','completed')
    and ((auth.uid() = driver and q.requester_id = p_recipient_id)
      or (p_recipient_id = driver and q.requester_id = auth.uid()))
  ) then raise exception 'Only completed ride participants can rate each other'; end if;
  insert into public.ride_ratings values (p_ride_id, auth.uid(), p_recipient_id, p_stars, coalesce(trim(p_comment), ''), now())
  on conflict (ride_id, author_id, recipient_id) do nothing;
  if not found then raise exception 'You already reviewed this ride'; end if;
end $$;

-- Only items the caller has not reviewed yet. The return type changes, so the old function is dropped first.
drop function if exists public.review_targets(uuid);
create function public.review_targets(p_subject_id uuid)
returns table (kind text, item_id uuid, title text, item_date timestamptz)
language sql stable security definer set search_path = public as $$
  select * from (
    select 'ride'::text, r.id, coalesce(r.destination, 'Ride'), r.date_time
    from public.rides_offered r
    where r.status = 'completed' and p_subject_id <> auth.uid() and exists (
      select 1 from public.ride_requests q where q.ride_id = r.id and q.status in ('accepted','completed')
        and ((auth.uid() = r.driver_id and q.requester_id = p_subject_id)
          or (p_subject_id = r.driver_id and q.requester_id = auth.uid())))
      and not exists (select 1 from public.ride_ratings x
        where x.ride_id = r.id and x.author_id = auth.uid() and x.recipient_id = p_subject_id)
    union all
    select 'host'::text, a.id, a.title, a.date_time
    from public.activities a
    where a.host_id = p_subject_id and a.host_id <> auth.uid() and a.date_time < now()
      and exists (select 1 from public.rsvps v where v.activity_id = a.id and v.user_id = auth.uid())
      and not exists (select 1 from public.host_reviews h where h.activity_id = a.id and h.author_id = auth.uid())
  ) targets order by 4 desc nulls last;
$$;

revoke all on function public.review_targets(uuid) from public;
grant execute on function public.review_targets(uuid) to authenticated;
notify pgrst, 'reload schema';
commit;
