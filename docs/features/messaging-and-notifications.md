## Purpose
  The purpose of this feature is to allow users to connect with each
  other and be able to send messages using the in-app chat window.
  Similarly, it also serves the purpose of connecting all the
  activity attendees by automatically creating a group chat.
  
  ## Assumptions
  - A user will only be expected to message people they follow
  - A user will be willing to join a group chat when they join an
  activity
  - A user will not feel the need to send images and other files
  using the chat feature

  ## Decisions
  The first step was to decide the database schema.

  - **Follows** are tracked in a `follows` table with a
  `follower_id`, `following_id`, and a `status` of pending,
  accepted, or rejected. A follow request must be accepted before it
  counts as a real connection.
  - **Conversations** are split into a `conversations` table (a
  `type` of direct or group, and an optional linked `activity_id`)
  and a `conversation_participants` table listing who belongs to
  each conversation and their `role` (member or admin). Messages
  themselves live in a separate `messages` table tied to a
  conversation.
  - **Direct messages** are only ever created through a server-side
  function that checks the sender actually follows the recipient
  before opening a conversation. This keeps the "only message people
  you follow" rule enforced by the database
  - **Group chats** are created automatically the moment an activity
  is created, with the host set as admin. Members are added
  automatically when they join the activity, and removed
  automatically if they leave
  - **Notifications** are stored in one shared table with a `type`
  field that tells the app which kind of notification it is (a
  follow request, an accepted follow, an activity join request, and
  so on). This lets follow requests and activity join requests reuse
  the same accept/reject UI instead of building a separate system
  for each.

  ## Technical Hurdles
  - **Names showing as "Rollin' User" instead of the real name.**
  The app tried to look up a person's profile through a shortcut
  join, but that shortcut only works when two tables are directly
  linked in the database. Conversation participants aren't linked to
  profiles that way, so the lookup failed and fell back to
  a placeholder name for every conversations. 
  - **Profile pictures showing an old or unrelated photo.** Every
  time someone uploaded a new profile picture, it was saved to the
  same file location as before. Because the photo's address never
  changed, the app's image cache kept showing the old photo
  everywhere except the profile screen itself. 
  - **Accepted or declined requests reappearing later.** Accepting
  or declining a follow or join request only marked it as read, it
  didn't remove it. The next time notifications were loaded, the
  same request would show up again.
 
  ## Feature Workflow
  - **Following someone:** A user visits another user's profile and
  taps Follow. This creates a pending request, and the other user
  receives a notification with Accept and Reject actions. Once
  accepted, both users are notified and the two are  connected.
  - **Sending a direct message:** From a followed user's profile,
  the user taps Message. The app finds an existing conversation
  between the two people or create a new one, then opens the chat
  screen. Messages sent by one person appear for both in real
  time.
  - **Joining an activity's group chat:** As soon as an activity is
  created, its group chat exists with the host as admin. Activity attedees are
  automatically added to that activity's group chat. If they later
  leave the activity, they're automatically removed from the chat
  too.
  - **Getting notified:** Follow requests and activity join requests
  appear in the Notifications tab with Accept and Reject buttons.


  ## Interface Details
  - **Profile screen:** A Follow/Following/Requested button reflects
  the current relationship. A Message button only appears once the
  user is actually following that person.
  - **Chats tab:** A single list of all conversations, direct and
  group, each showing the other person's (or the activity's) name,
  photo, and a preview of the last message.
  - **Chat screen:** A back button, name, and photo at the top;
  messages appear as bubbles, aligned differently depending on who
  sent them. In a group chat, each message also shows the sender's
  name. A text field and send button sit at the bottom.
  - **Notifications tab:** A simple list taht shows the newest first. Follow and
  join requests show the requester's photo and name with
  Accept/Reject buttons. Other notifications are plain rows with a
  message and a timestamp with unread ones visually marked.

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
| `hooks/use-conversations.ts` | Builds conversation summaries and loads their latest messages |
| `hooks/use-messages-realtime.ts` | Subscribes to new messages for the active conversation |
| `hooks/use-notification-realtime.ts` | Subscribes to new notifications for the signed-in user |
| `services/ride-notifications-service.ts` | Configures and sends local notifications used by live rides |
