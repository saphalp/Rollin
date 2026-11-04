# Muting Chats and Notification Settings

Users can mute one conversation or turn off chat push notifications altogether. Messages still arrive in the chat; muting changes the notification, not the conversation.

## Mute a chat

Open the conversation and tap the bell in its header. A crossed-out bell means it is muted. Tap again to unmute it. This affects only your account, not the other members.

## Change notification preferences

Open the profile menu and choose **Notifications**. Changes are saved as each setting is switched on or off. Missing settings use the default: notifications on and chats unmuted.

The **Chat messages** setting is checked by the chat push function. The other category settings are stored too, but do not assume every notification sender uses them without checking its implementation. Activity announcements bypass these category and chat mute settings; delivery can still fail because of device permissions or a missing push token.

## How chat pushes are sent

After saving a message, the app calls `notify-message` with its ID. The server confirms the caller sent it, finds the other members, and skips people who muted the chat or disabled chat messages. Everyone else with a usable token can receive the sender's name and message preview.

Checking preferences on the server prevents the sender's phone from overriding someone else's mute. Users can read and change only their own settings.

`notification_settings` stores the category choices. `muted_conversations` stores which chats each user muted. The setup is in `supabase/migrations/20261012120000_notification_settings.sql`.

## Problems we ran into

Push registration failed at first because signed-in users did not have permission to save rows in `push_tokens`. The server also needed permission to read messages, chat members, and profiles. Check those grants when recreating the backend.

During testing, a missing push once turned out to be a still-muted chat. When checking delivery, look at both the app's preferences and the phone's notification permission. Use a development or installed Android build for remote push testing; Expo Go does not support it.

## Main files

- `app/notification-settings.tsx`: category switches.
- `components/chats/ConversationHeader.tsx` and `app/chat/[id].tsx`: mute control.
- `supabase/functions/notify-message/index.ts`: push recipients and preference checks.
- `components/profile-sidebar.tsx`: link to settings.
