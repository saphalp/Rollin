## Purpose

The purpose of this feature is to allow users to connect with each other and be able to send messages using the in-app chat window. Similarly, it also serves the purpose of connecting all the activity attendees by automatically creating a group chat.
  
## Assumptions

- A user will only be expected to message people they follow
- A user will be willing to join a group chat when they join an activity
- A user will not feel the need to send images and other files using the chat feature

## Decisions

The first step was to decide the database schema.

- **Follows** are tracked in a `follows` table with a `follower_id`, `following_id`, and a `status` of pending, accepted, or rejected. A follow request must be accepted before it counts as a real connection.
- **Conversations** are split into a `conversations` table (a `type` of direct or group, and an optional linked `activity_id`) and a `conversation_participants` table listing who belongs to each conversation and their `role` (member or admin). Messages themselves live in a separate `messages` table tied to a conversation.
- **Direct messages** are only ever created through a server-side function that checks the sender actually follows the recipient before opening a conversation. This keeps the "only message people you follow" rule enforced by the database
- **Group chats** are created automatically the moment an activity is created, with the host set as admin. Members are added automatically when they join the activity, and removed automatically if they leave
- **Notifications** are stored in one shared table with a `type` field that tells the app which kind of notification it is (a follow request, an accepted follow, an activity join request, and so on). This lets follow requests and activity join requests reuse the same accept/reject UI instead of building a separate system for each.

## Technical Hurdles

- **Names showing as "Rollin' User" instead of the real name.** The app tried to look up a person's profile through a shortcut join, but that shortcut only works when two tables are directly linked in the database. Conversation participants aren't linked to profiles that way, so the lookup failed and fell back to a placeholder name for every conversations. 
- **Profile pictures showing an old or unrelated photo.** Every time someone uploaded a new profile picture, it was saved to the same file location as before. Because the photo's address never changed, the app's image cache kept showing the old photo everywhere except the profile screen itself. 
- **Accepted or declined requests reappearing later.** Accepting or declining a follow or join request only marked it as read, it didn't remove it. The next time notifications were loaded, the same request would show up again.
 
## Feature Workflow

- **Following someone:** A user visits another user's profile and taps Follow. This creates a pending request, and the other user receives a notification with Accept and Reject actions. Once accepted, both users are notified and the two are  connected.
- **Sending a direct message:** From a followed user's profile, the user taps Message. The app finds an existing conversation between the two people or create a new one, then opens the chat screen. Messages sent by one person appear for both in real time.
- **Joining an activity's group chat:** As soon as an activity is created, its group chat exists with the host as admin. Activity attedees are automatically added to that activity's group chat. If they later leave the activity, they're automatically removed from the chat too.
- **Getting notified:** Follow requests and activity join requests appear in the Notifications tab with Accept and Reject buttons.


## Interface Details
- **Profile screen:** A Follow/Following/Requested button reflects the current relationship. A Message button only appears once the user is actually following that person.
- **Chats tab:** A single list of all conversations, direct and group, each showing the other person's (or the activity's) name, photo, and a preview of the last message.
- **Chat screen:** A back button, name, and photo at the top; messages appear as bubbles, aligned differently depending on who sent them. In a group chat, each message also shows the sender's name. A text field and send button sit at the bottom.
- **Notifications tab:** A simple list taht shows the newest first. Follow and join requests show the requester's photo and name with Accept/Reject buttons. Other notifications are plain rows with a message and a timestamp with unread ones visually marked by a blue dot. Opening the tab marks every listed unread notification read (and any that arrive while it's open); the blue dots stay for that visit so new items stand out, and clear when the user leaves the tab.
- **Header bell:** A small red dot appears on the bell icon in the tab header while the user has any notification with `is_read = false`. It clears as soon as the Notifications tab marks everything read (the screen signals the hook via `notifyNotificationsRead`), updates live through realtime inserts/updates and is rechecked on every navigation and when the app returns to the foreground (realtime can't deliver filtered deletes).

## Relevant Files

| File | Role |
|---|---|
| `app/(tabs)/chats.tsx` | Displays the user's direct and activity-group conversations |
| `app/chat/[id].tsx` | Loads a conversation, sends messages, and renders incoming real-time messages |
| `app/(tabs)/notifications.tsx` | Loads notifications and handles follow and activity-join request decisions |
| `components/chats/ChatCards.tsx` | Renders a conversation preview in the chat list |
| `components/chats/ConversationHeader.tsx` | Displays the conversation title, avatar, and back navigation |
| `components/chats/MessageBubble.tsx` | Renders sent and received message bubbles |
| `components/chats/MessageInput.tsx` | Provides the message composer and send action |
| `components/notification-row.tsx` | Renders a standard read or unread notification |
| `components/follow-request-row.tsx` | Renders follow-request accept and reject actions |
| `components/activity-join-request-row.tsx` | Renders activity-join request accept and reject actions |
| `hooks/use-conversations.ts` | Refreshes conversation summaries, unread counts, archives, and per-user deletion |
| `hooks/use-chat-conversation.ts` | Loads message history, catches up after reconnect, sends messages, and acknowledges reads |
| `services/messaging-service.ts` | Authenticated chat queries, shared-content previews, subscriptions, and read/write requests |
| `lib/messaging.ts` | Message ordering, deduplication, preview text, and read-label formatting |
| `hooks/use-notification-realtime.ts` | Subscribes to new notifications for the signed-in user |
| `hooks/use-unread-notifications.ts` | Tracks whether the signed-in user has unread notifications, for the header bell's red dot |
| `services/ride-notifications-service.ts` | Configures and sends local notifications used by live rides |

## Live conversations and read status (Sprint 6)

The active and archived conversation lists show the latest message preview, its timestamp,
and the number of unread incoming messages. Newest conversations move to the top. Shared
activities and posts have readable previews even when their message content is empty.
Unread counts above 99 display as `99+`.

Focused chat screens subscribe to messages, conversation membership, archive state,
per-user deletions, and read positions. Changes trigger a short debounced refresh. The
screens also refresh on focus, foregrounding, and reconnect, with a 30-second foreground
fallback for missed events (including filtered deletes). Silent refreshes keep existing
content visible; failures show a Retry action instead of pretending the list is empty.
Subscriptions, timers, and pending reads are cleaned up when leaving the screen or
switching accounts.

### Read behavior

- Read position belongs to the account and conversation and persists across devices.
- Opening a chat at its latest messages acknowledges everything through that displayed
  message. It does not require scrolling through every earlier message in the history.
- Incoming messages are acknowledged while the chat is focused, the app is in the
  foreground, and the user is at the bottom. Scrolling through older history does not
  automatically acknowledge new messages arriving below it.
- The server accepts a real message ID, looks up its timestamp, and moves the read
  position forward atomically. Device clocks and older in-flight requests cannot rewind it.
- Unread counts exclude the user's own messages and messages sent before their current
  conversation membership began. Existing incoming history after joining initially counts
  as unread until the conversation is opened; no historical reads are fabricated.
- Sent messages display **Sent**, then **Read** for a direct chat or **Read by N** for a
  group. Read means the recipient opened the conversation through that message; it is
  not proof they read every word. These labels also apply to shared activities/posts.
- Only current, email-verified conversation members can see its read positions. Only the
  authenticated caller's position can be advanced. Leaving removes that membership's
  read state.

### History, sending, and errors

The newest 50 messages load first, with **Load older messages** for earlier pages.
Paging uses the timestamp and message ID together, including PostgreSQL microseconds,
so equal timestamps do not drop messages. Reconnect catches up through every newer
page. Messages from the send response and subsequent Realtime refreshes deduplicate by ID.
Older-history loading preserves the scroll position instead of forcing it to the bottom.
Date separators distinguish messages sent on different days.

The chat adjusts for the keyboard on both Android and iOS. Message history shrinks
while the composer stays above the keyboard; the extra bottom safe-area spacing is
used only when the keyboard is closed. When already viewing the newest messages,
the history stays at the bottom as the keyboard opens or the composer grows.

The composer blocks duplicate taps while sending. Text clears only after a successful
database response and stays available for retry after failure. A successful send appears
without waiting for the Realtime echo; push-notification delivery does not determine
whether the message was sent. As with other network writes, an ambiguous connection
failure can require checking the history before retrying to avoid sending the same text
twice. This is not an offline send queue.

Archived group chats remain available for history, with the composer hidden. Deletion
still hides the conversation only for the current user. A failed deletion leaves it in
the list and shows an error. Muting still controls notifications separately from read state.

Shared-content lookups continue to use the caller's normal Supabase permissions. If the
shared activity or post is unavailable, the message displays an unavailable-content notice
instead of inventing a working preview.

### One-time Supabase setup

Apply `supabase/migrations/20261029120000_chat_read_status.sql` **before running this
updated chat UI**. It depends on the existing email-login verification functions and the
archive/delete schema from `20261027130000_conversation_archive_delete.sql`.

1. Open the correct Rollin Supabase project's **SQL Editor** and create a new query.
2. Paste the complete contents of `20261029120000_chat_read_status.sql` and run it.
3. Confirm the query succeeds. The script is transactional and can be run again safely.
4. Restart the app and test with two signed-in accounts.

The script creates `conversation_read_state` with RLS enabled, three RPC functions,
and a message-order index. It adds the five chat tables to `supabase_realtime` if that
publication exists and the tables are not already included. It preserves existing chat
access policies and requires verified email-login sessions for the new operations.
No new secret, Edge Function deployment, paid service, or dependency is required.
If the publication does not exist in a non-Supabase test database, the application still
has its polling fallback. Do not run every pending migration blindly just for this feature.

### Validation

Automated tests:

```sh
node --test scripts/test-messaging.cjs scripts/test-messaging-db.cjs
```

The database tests use isolated PGlite, never the live Supabase project. If it is not
installed locally, install it outside the app's dependencies:

```sh
npm install --prefix .expo/login-security-validation --no-package-lock --ignore-scripts @electric-sql/pglite@0.5.9
```

Two-account acceptance checks after applying the SQL:

1. Keep B on the Chats tab. Send messages from A. B's preview, time, list order, and count
   should update without pulling to refresh. A's own message does not add to A's count.
2. Open the conversation on B. Its unread count clears and A sees Read. Repeat in a group
   and check Read by N.
3. Background B or scroll it into older history. Send another message from A. It should
   remain unread until B returns to the foreground and reaches the bottom.
4. Create more than 50 messages. Load older pages, return from the background after a
   burst of messages, and check that history has no missing or duplicate messages.
5. Disable networking and try sending. The text should remain with a visible error.
   Restore networking and retry. Also test a failed history refresh and list refresh.
6. Archive a group and delete a conversation for B. Verify archive/history and deletion
   behavior, and that A's conversation remains. Sign out and switch accounts; the other
   account's cached messages must not appear.
