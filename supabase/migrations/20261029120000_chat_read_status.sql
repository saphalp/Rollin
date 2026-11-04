begin;

-- Per-account read position; removing membership also removes its read state.
create table if not exists public.conversation_read_state (
  conversation_id uuid not null,
  user_id uuid not null,
  last_read_at timestamptz not null,
  last_read_message_id uuid not null,
  primary key (conversation_id, user_id),
  foreign key (conversation_id, user_id)
    references public.conversation_participants(conversation_id, user_id) on delete cascade
);
alter table public.conversation_read_state enable row level security;
revoke all on public.conversation_read_state from public, anon, authenticated;
grant select on public.conversation_read_state to authenticated;
drop policy if exists chat_members_read_receipts on public.conversation_read_state;
create policy chat_members_read_receipts on public.conversation_read_state
  for select to authenticated using (
    public.login_email_verified() and exists (
      select 1 from public.conversation_participants p
      where p.conversation_id = conversation_read_state.conversation_id and p.user_id = auth.uid()
    )
  );

create index if not exists messages_conversation_order_idx
  on public.messages(conversation_id, created_at desc, id desc);

-- Accept a real observed message, never a device timestamp or another user's ID.
-- Only this RPC may write read state, and older requests cannot move it backwards.
create or replace function public.mark_conversation_read(p_conversation_id uuid, p_message_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare message_time timestamptz;
begin
  if auth.uid() is null or not public.login_email_verified() then
    raise exception 'Complete email login verification first.' using errcode = '42501';
  end if;
  perform 1 from public.conversation_participants
    where conversation_id = p_conversation_id and user_id = auth.uid() for key share;
  if not found then raise exception 'Conversation unavailable.' using errcode = '42501'; end if;
  select created_at into message_time from public.messages
    where id = p_message_id and conversation_id = p_conversation_id;
  if not found then raise exception 'Message unavailable.'; end if;
  insert into public.conversation_read_state as r
    (conversation_id, user_id, last_read_at, last_read_message_id)
    values (p_conversation_id, auth.uid(), message_time, p_message_id)
  on conflict (conversation_id, user_id) do update
    set last_read_at = excluded.last_read_at, last_read_message_id = excluded.last_read_message_id
    where (r.last_read_at, r.last_read_message_id) < (excluded.last_read_at, excluded.last_read_message_id);
end;
$$;
revoke all on function public.mark_conversation_read(uuid, uuid) from public, anon;
grant execute on function public.mark_conversation_read(uuid, uuid) to authenticated;

-- RLS and the current caller's membership still govern every source table.
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
    and not exists (select 1 from public.deleted_conversations d where d.conversation_id = c.id and d.user_id = auth.uid());
$$;
revoke all on function public.get_conversation_summaries() from public, anon;
grant execute on function public.get_conversation_summaries() to authenticated;

-- Stable keyset paging handles identical timestamps, new inserts, and server row caps.
create or replace function public.get_chat_messages(
  p_conversation_id uuid, p_cursor_at timestamptz default null,
  p_cursor_id uuid default null, p_newer boolean default false
) returns setof public.messages language sql stable security invoker set search_path = '' as $$
  select m.* from public.messages m
  where m.conversation_id = p_conversation_id and public.login_email_verified()
    and exists (select 1 from public.conversation_participants p where p.conversation_id = m.conversation_id and p.user_id = auth.uid())
    and (p_cursor_at is null or
      (not p_newer and (m.created_at, m.id) < (p_cursor_at, p_cursor_id)) or
      (p_newer and (m.created_at, m.id) > (p_cursor_at, p_cursor_id)))
  order by
    case when p_newer then m.created_at end asc, case when p_newer then m.id end asc,
    case when not p_newer then m.created_at end desc, case when not p_newer then m.id end desc
  limit 50;
$$;
revoke all on function public.get_chat_messages(uuid, timestamptz, uuid, boolean) from public, anon;
grant execute on function public.get_chat_messages(uuid, timestamptz, uuid, boolean) to authenticated;

-- Idempotently publish only tables needed for chat refreshes. Existing RLS is preserved.
do $$
declare table_name text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach table_name in array array['messages','conversations','conversation_participants','deleted_conversations','conversation_read_state'] loop
      if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = table_name) then
        execute format('alter publication supabase_realtime add table public.%I', table_name);
      end if;
    end loop;
  end if;
end;
$$;
notify pgrst, 'reload schema';
commit;
