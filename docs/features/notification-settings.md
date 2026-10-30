# Mute Chats and Notification Settings

## Purpose

Users can mute individual chats and choose which kinds of notifications they get. Chat push notifications respect both, so a muted chat or a turned-off category stays quiet.

## Assumptions

- Muting is per chat and per user. Muting a chat only affects your own notifications.
- Every notification type is on by default.
- Muted chats still receive messages. Only the push notification is skipped.
- Activity announcements are always delivered, even when a chat is muted or a setting is off.
- Right now only the **Chat messages** setting changes push behavior. The other settings are saved, ready for when those pushes are added.

## Decisions

### Two small tables

`notification_settings` has one row per user with a true/false column for each type (`chat_messages`, `activity_updates`, `ride_updates`, `follow_requests`). `muted_conversations` has one row per muted chat. Missing rows mean the default: notifications on and the chat unmuted, so new users need no setup.

### Mute checked on the server

When a message is sent, the app calls the `notify-message` edge function with the message ID. The function confirms the caller sent the message, finds the other participants, skips anyone who muted the chat or turned off chat messages, and pushes to the rest. Checking on the server means a sender's app can't push to someone who muted them.

### Users control only their own rows

RLS on both tables limits every read and write to `user_id = auth.uid()`, so users can see and change only their own settings.

## Technical Hurdles

- No device was saving its push token because `push_tokens` had no grant for `authenticated`. Fixed with `grant select, insert, update on public.push_tokens to authenticated`. This fixed push for every feature, not just chat.
- `notify-message` needed `select` grants on `messages`, `conversation_participants`, and `profiles` for `service_role`.
- During testing, a "missing" push turned out to be a chat that was still muted, which confirmed the mute worked.

## Feature Workflow

**Muting a chat:**
1. Open a chat and tap the bell in the header.
2. The bell changes to a crossed-out bell, and a row is added to `muted_conversations`.
3. Tap it again to unmute.

**Changing notification settings:**
1. Open the profile sidebar and tap **Notifications**.
2. Turn any type on or off. Each change is saved right away to `notification_settings`.

**When a message is sent:**
1. The message is saved, then the app calls `notify-message`.
2. Recipients who muted the chat or turned off chat messages are skipped.
3. Everyone else gets a push with the sender's name and a preview of the message.

## Relevant files

- `supabase/migrations/20261012120000_notification_settings.sql`: `notification_settings` and `muted_conversations` tables, RLS, and grants
- `supabase/functions/notify-message/index.ts`: sends chat pushes and skips muted or opted-out users
- `app/notification-settings.tsx`: Notifications settings screen
- `components/chats/ConversationHeader.tsx`: mute bell in the chat header
- `app/chat/[id].tsx`: loads and toggles mute, calls `notify-message` after sending
- `components/profile-sidebar.tsx`: Notifications link in the sidebar