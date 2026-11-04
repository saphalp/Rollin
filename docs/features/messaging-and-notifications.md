# Messaging and Notifications

Rollin has direct messages and activity group chats so students can make plans without leaving the app. Notifications bring together follow requests, activity requests, and other updates.

## Starting a conversation

From a profile you follow, tap **Message** to open a direct chat. The server checks the accepted follow before creating the conversation. If the conversation already exists, the app opens it instead of making another one.

Activity group chats are created with the activity, with the host as admin. Joining an activity adds the attendee to its chat; leaving removes them. The Chats tab shows direct and group conversations together, newest first.

Search filters existing conversations. After two characters, it also looks for people to start a direct message with.

## Sending and reading messages

Each conversation preview shows the latest message, its time, and an unread count. Counts above 99 show **99+**. Shared activities and posts have a readable preview, even when the message has no text.

Opening a chat loads the newest 50 messages. Use **Load older messages** for more history. The page keeps your place when you load older messages, and the text box stays above the keyboard while typing.

The send button waits while a message is being sent. Text clears after a successful save and stays in the box if sending fails. A saved message appears right away without waiting for a push notification. There is no offline message queue; after an uncertain connection failure, check the conversation before sending the same text again.

The chat also shows when another person is typing. Long-press a message to react, reply, copy, forward, pin, or delete it:

- Reply keeps a reference to the original message. If that message is not loaded, the quote says it is unavailable.
- Each person can add one reaction per message. Choosing it again removes it.
- One message can be pinned at a time, with a banner under the header.
- Forward sends the text to another active conversation.
- **Delete for me** hides a message only for you. The sender can also delete it for everyone.

## Sent, delivered, and seen

The latest outgoing message can show **Sent**, **Delivered**, or **Seen**. In groups, the label can include how many members received or saw it. These labels also apply to shared activities and posts.

Delivery means another member's app has acknowledged the message. Seen means the chat was open through that message; it does not prove someone read every word.

The app marks incoming messages as read when the chat is open in the foreground and the user is at the bottom. New messages stay unread while the user is looking at older history or has the app in the background. Opening the latest messages clears earlier unread messages in that conversation too.

Read progress is saved per account and chat, so it carries across devices. Your own messages and messages from before you joined the chat do not add to your unread count. The server uses actual message IDs to update progress; an older request cannot move it backwards.

## Refresh, archived chats, and errors

The chat list and open conversation listen for changes. They also reload when reopened, when the app returns to the foreground, and after reconnecting. A check every 30 seconds while open catches updates that may have been missed.

Failed refreshes keep the loaded content and show Retry. Changing accounts clears old requests so another person's messages cannot appear. Shared content is loaded using the viewer's permissions; deleted or private content shows as unavailable.

Archived activity chats keep their history but do not allow new messages. Deleting a conversation hides it only for your account. A newer message can bring it back. [Muting](notification-settings.md) controls push notifications separately from read status.

## Notifications

Follow and activity-join requests have Accept and Reject controls. Other updates show a message and time. Opening Notifications marks the listed unread items as read, including arrivals while the page is open. Blue dots stay visible during that visit so those items are easy to spot, then clear when the user leaves.

The header bell has a red dot while unread notifications exist. It updates after reads and live changes, and checks again during navigation or when the app reopens.

## Problems we ran into

Conversation names originally showed as “Rollin' User” because a profile lookup assumed a database relationship that did not exist. We now load the needed profiles separately. Profile photos also used to stay cached after an upload; unique image paths fix that.

Accepted and rejected requests once reappeared because handling them only marked them as read. Request decisions need to update the request itself as well as its notification.

Loading history needs a consistent order. We use the saved timestamp and message ID together so messages with the same time are not skipped. Sending, live updates, and reconnects can return the same message, so the app keeps one copy per ID.

## Supabase setup

Check the shared project's setup before applying these files to a new environment:

| File in `supabase/migrations/` | Adds |
|---|---|
| `20261027130000_conversation_archive_delete.sql` | Archived chats and per-user conversation deletion |
| `20261029120000_chat_read_status.sql` | Read progress, conversation summaries, and message-history functions |
| `20261030120000_reopen_deleted_conversations.sql` | Brings a hidden conversation back when a newer message arrives |
| `20261103130000_chat_delivery_status.sql` | Delivery progress and acknowledgements |

The read-status and delivery files depend on the existing login-email verification functions. Run complete files in the SQL Editor and confirm success before testing. The read-status script can be rerun safely and adds the chat tables to Realtime when that publication exists. It does not replace the existing chat membership rules.

Some chat actions were created directly in the Supabase dashboard. The `message_reactions`, `conversation_pins`, and `hidden_chat_messages` tables, message reply/deletion columns, and `pin_chat_message`, `unpin_chat_message`, and `delete_chat_message` functions do not yet have a migration in this repository. Export their definitions from the existing project before trying to recreate them elsewhere.

Chat pushes use the `notify-message` Edge Function and device push tokens. See [Notification Settings](notification-settings.md) for that setup. No extra secret is needed just for read or delivery status.

## Main files

- `app/(tabs)/chats.tsx` and `components/chats/ChatCards.tsx`: the conversation list.
- `app/chat/[id].tsx`: the open conversation.
- `hooks/use-conversations.ts`: previews, counts, archives, and deletion.
- `hooks/use-chat-conversation.ts`: history, sending, and read/delivery progress.
- `services/messaging-service.ts` and `lib/messaging.ts`: database requests and message helpers.
- `hooks/use-chat-actions.ts` and `services/chat-actions-service.ts`: reactions, replies, pins, and message deletion.
- `app/(tabs)/notifications.tsx`: notification list and request decisions.
- `hooks/use-unread-notifications.ts`: the header bell's unread dot.

## Testing

```powershell
node --test scripts/test-messaging.cjs scripts/test-messaging-db.cjs
```

The database tests use a temporary local database, not Supabase. If PGlite is missing, install it outside the app's dependencies:

```powershell
npm install --prefix .expo/login-security-validation --no-package-lock --ignore-scripts @electric-sql/pglite@0.5.9
```

Use two accounts on separate devices or emulators. Send messages while the other account is on the chat list, then open the conversation and check the count and Seen status. Repeat in a group. Check messages arriving while the recipient is in the background or reading older history.

Test more than 50 messages, a failed send, Retry, returning after a lost connection, an archived group, and deleting a conversation for only one user. Also check keyboard placement, message actions, shared private content, and switching accounts.
