-- Add is_archived to conversations
alter table public.conversations
  add column if not exists is_archived boolean not null default false;

-- Trigger: auto-archive group conversation when linked activity expires or is cancelled
create or replace function public.archive_conversation_on_activity_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.status in ('expired', 'cancelled'))
     and (old.status is distinct from new.status) then
    update public.conversations
    set is_archived = true
    where activity_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_archive_conversation_on_activity_status on public.activities;
create trigger trg_archive_conversation_on_activity_status
  after update on public.activities
  for each row
  execute function public.archive_conversation_on_activity_status();

-- Backfill: archive existing group conversations whose activity is already expired/cancelled
update public.conversations c
set is_archived = true
from public.activities a
where c.activity_id = a.id
  and a.status in ('expired', 'cancelled')
  and c.is_archived = false;

-- Per-user soft delete for direct message conversations
create table if not exists public.deleted_conversations (
  user_id        uuid not null references public.profiles(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  deleted_at     timestamptz not null default now(),
  primary key (user_id, conversation_id)
);

alter table public.deleted_conversations enable row level security;

create policy "Users manage their own deleted conversations"
  on public.deleted_conversations
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, insert, delete on public.deleted_conversations to authenticated;
