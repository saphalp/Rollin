begin;

-- Deleting a chat hides it only until someone sends a newer message. Re-deleting
-- refreshes deleted_at, so the client upserts the row and needs UPDATE.
grant update on public.deleted_conversations to authenticated;

create or replace function public.get_conversation_summaries()
returns table (
  id uuid, type text, activity_id uuid, is_archived boolean, title text, avatar_path text,
  category text, other_user_id uuid, last_message text, last_message_type text,
  last_message_at timestamptz, unread_count bigint
) language sql stable security invoker set search_path = '' as $$
  select c.id, c.type, c.activity_id, c.is_archived,
    case when c.type = 'direct' then coalesce(profile.full_name, 'Rollin'' User') else coalesce(a.title, 'Activity chat') end,
    case when c.type = 'direct' then profile.profile_picture else a.image_url end,
    a.category, other.user_id, latest.content, latest.type, coalesce(latest.created_at, c.created_at),
    (select count(*) from public.messages m where m.conversation_id = c.id
      and m.sender_id <> auth.uid() and m.created_at >= own.joined_at
      and (r.last_read_at is null or (m.created_at, m.id) > (r.last_read_at, r.last_read_message_id)))
  from public.conversation_participants own
  join public.conversations c on c.id = own.conversation_id
  left join public.conversation_read_state r on r.conversation_id = c.id and r.user_id = auth.uid()
  left join lateral (select p.user_id from public.conversation_participants p
    where p.conversation_id = c.id and p.user_id <> auth.uid() and c.type = 'direct'
    order by p.user_id limit 1) other on true
  left join public.profiles profile on profile.id = other.user_id
  left join public.activities a on a.id = c.activity_id
  left join lateral (select m.content, m.type, m.created_at from public.messages m
    where m.conversation_id = c.id order by m.created_at desc, m.id desc limit 1) latest on true
  where own.user_id = auth.uid() and public.login_email_verified()
    and not exists (select 1 from public.deleted_conversations d
      where d.conversation_id = c.id and d.user_id = auth.uid()
        and (latest.created_at is null or latest.created_at <= d.deleted_at));
$$;
revoke all on function public.get_conversation_summaries() from public, anon;
grant execute on function public.get_conversation_summaries() to authenticated;

notify pgrst, 'reload schema';
commit;
