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

Reading every attendee's push token needs the service-role key, which can't ship in the app. The `announce` function