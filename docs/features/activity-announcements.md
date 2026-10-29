# Activity Announcements

## Purpose

Hosts can send one message to everyone who joined their activity, such as a time change or a reminder. Attendees get a push notification and can see recent announcements on the activity page.

## Assumptions

- Only the activity host can post an announcement.
- Announcements go to everyone who RSVP'd, except the host.
- Announcements are always delivered. They ignore chat mute and notification settings, because they're about plans the attendee already committed to.
- A message must be between 1 and 1000 characters.
- Only the host and attendees can read an activity's announcements.

## Decisions

### Saved first, then pushed

The app saves the announcement to the `announcements` table, then calls the `announce` edge function with the new row's ID. Saving first means the message still appears on the activity page even if the push fails, and the host sees "posted, but notifications could not be sent" instead of losing the message.

### Push sent from an edge function

Reading every attendee's push token needs the service-role key, which can't ship in the app. The `announce` function verifies the caller with their own token, checks that they host the activity, then uses the service-role client to load RSVPs and push tokens and send the push through Expo in batches of 100.

### Access enforced by RLS

Insert and select policies on `announcements` enforce the host-only and attendees-only rules in the database, so the rules hold even if the client is bypassed. The function also re-checks the host before sending.

## Technical Hurdles

- Tables created in the SQL Editor had no grants, so inserts failed with "permission denied." The migration now grants `select, insert` to `authenticated` and `all` to `service_role`.
- The function first returned a 500 because `service_role` couldn't read `rsvps`. Fixed with `grant select on public.rsvps to service_role`.

## Feature Workflow

1. The host opens their activity and taps **⋮ → Send Announcement**.
2. They write a message on the compose screen and tap **Send Announcement**.
3. The app inserts a row into `announcements`, and RLS confirms the sender is the host.
4. The app calls `announce`, which pushes the message to every attendee with a saved push token.
5. The latest five announcements show in the **Announcements** section of the activity page.

## Relevant files

- `supabase/migrations/20261005120000_activity_announcements.sql`: `announcements` table, RLS policies, and grants
- `supabase/functions/announce/index.ts`: verifies the host and sends the push
- `app/activity/announce/[id].tsx`: compose screen with a 1000-character limit
- `app/activity/[id].tsx`: Send Announcement menu item and the Announcements section