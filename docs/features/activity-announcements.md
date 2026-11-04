# Activity Announcements

Hosts can send an update to everyone who joined their activity, such as a reminder or a change of plans. The latest five announcements also appear on the activity page.

## Send an announcement

1. Open an activity you host.
2. Open the three-dot menu and choose **Send Announcement**.
3. Write a message between 1 and 1,000 characters, then send it.

Only the host can post. The host and attendees can read announcements. Push messages are sent to attendees other than the host who have a saved device token.

Activity announcements bypass chat mute and notification-category settings because they concern plans the attendee joined. Push delivery still depends on device permissions, a valid token, and the notification service; it cannot be guaranteed.

## Why the message is saved first

The app saves the announcement before asking the server to send notifications. That way, a push failure does not lose the update. The host sees a message explaining that it was posted but notifications could not be sent, and attendees can still read it on the activity page.

The `announce` Edge Function checks that the sender hosts the activity, loads the attendees' push tokens, and sends through Expo in groups of up to 100. The server handles this because the app should not have access to everyone's device tokens or the service-role key.

Database access rules also check who can post and read announcements. During setup, missing table grants caused permission errors; the migration supplies the needed access to announcements and lets the server read RSVPs.

## Main files

- `app/activity/announce/[id].tsx`: writing an announcement.
- `app/activity/[id].tsx`: menu entry and recent announcements.
- `supabase/functions/announce/index.ts`: checks the host and sends notifications.
- `supabase/migrations/20261005120000_activity_announcements.sql`: table and access rules.

Test with a host and attendee account. Check the saved announcement as well as the push, and verify a non-host cannot post.
