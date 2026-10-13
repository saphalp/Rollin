begin;

create table if not exists public.notification_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  chat_messages boolean not null default true,
  activity_updates boolean not null default true,
  ride_updates boolean not null default true,
  follow_requests boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.muted_conversations (
  user_id uuid not null references public.profiles(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  muted_at timestamptz not null default now(),
  primary key (user_id, conversation_id)
);

alter table public.notification_settings enable row level security;
alter table public.muted_conversations enable row level security;

grant select, insert, update on public.notification_settings to authenticated;
grant select, insert, delete on public.muted_conversations to authenticated;
grant select on public.notification_settings to service_role;
grant select on public.muted_conversations to service_role;
grant select on public.messages to service_role;
grant select on public.conversation_participants to service_role;
grant select on public.profiles to service_role;
grant select, insert, update on public.push_tokens to authenticated;

drop policy if exists "Users manage their own notification settings" on public.notification_settings;
create policy "Users manage their own notification settings" on public.notification_settings
for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Users manage their own muted chats" on public.muted_conversations;
create policy "Users manage their own muted chats" on public.muted_conversations
for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

commit;