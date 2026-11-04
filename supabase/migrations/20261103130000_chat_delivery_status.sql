begin;

-- Per-account delivery position for messages.
create table if not exists public.conversation_delivery_state (
  conversation_id uuid not null,
  user_id uuid not null,
  last_delivered_at timestamptz not null default now(),
  last_delivered_message_id uuid not null,
  primary key (conversation_id, user_id),
  foreign key (conversation_id, user_id)
    references public.conversation_participants(conversation_id, user_id) on delete cascade
);

alter table public.conversation_delivery_state enable row level security;
revoke all on public.conversation_delivery_state from public, anon, authenticated;
grant select on public.conversation_delivery_state to authenticated;
grant select, insert, update on public.conversation_delivery_state to service_role;

drop policy if exists chat_members_delivery_receipts on public.conversation_delivery_state;
create policy chat_members_delivery_receipts on public.conversation_delivery_state
  for select to authenticated using (
    public.login_email_verified() and exists (
      select 1 from public.conversation_participants p
      where p.conversation_id = conversation_delivery_state.conversation_id and p.user_id = auth.uid()
    )
  );

-- RPC for authenticated chat members to acknowledge delivery of messages.
create or replace function public.mark_conversation_delivered(p_conversation_id uuid, p_message_id uuid)
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
  insert into public.conversation_delivery_state as d
    (conversation_id, user_id, last_delivered_at, last_delivered_message_id)
    values (p_conversation_id, auth.uid(), message_time, p_message_id)
  on conflict (conversation_id, user_id) do update
    set last_delivered_at = excluded.last_delivered_at, last_delivered_message_id = excluded.last_delivered_message_id
    where (d.last_delivered_at, d.last_delivered_message_id) < (excluded.last_delivered_at, excluded.last_delivered_message_id);
end;
$$;
revoke all on function public.mark_conversation_delivered(uuid, uuid) from public, anon;
grant execute on function public.mark_conversation_delivered(uuid, uuid) to authenticated;

-- Add conversation_delivery_state to realtime publication
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'conversation_delivery_state') then
      execute 'alter publication supabase_realtime add table public.conversation_delivery_state';
    end if;
  end if;
end;
$$;

notify pgrst, 'reload schema';
commit;

