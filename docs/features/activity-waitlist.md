# Activity Waitlist

## Purpose

When an activity is full, users can join a waitlist instead of missing out. When someone leaves, the first person in line is moved into the activity automatically and notified.

## Assumptions

- The waitlist only appears once an activity reaches its max attendees.
- A user can be on an activity's waitlist only once.
- Line order is first come, first served, by the time each person joined.
- Users can see their own place in line, but not who else is waiting.
- Users can leave the waitlist at any time.

## Decisions

### Promotion runs in an edge function

Leaving an activity goes through the `leave-activity` edge function instead of a direct delete. The function removes the caller's RSVP, checks whether a spot opened, and if so moves the first person in line into `rsvps`, removes them from `waitlist`, and sends an in-app notification and a push. Doing this on the server means promotion happens even if the person leaving closes the app right away, and it needs the service-role key to add an RSVP for another user.

### Position is calculated, not stored

`waitlist` stores only `joined_at`. The `my_waitlist_positions()` function counts how many people joined before the current user, so positions stay correct as people leave without having to renumber every row.

### Capacity enforced in the database

A trigger on `rsvps` (`enforce_activity_capacity`) rejects a join when the activity is already full, with the message "This activity is full. Join the waitlist instead." This stops two people from taking the last spot at the same moment, which the app alone can't prevent.

## Technical Hurdles

- An activity showed 2/1 joined because capacity was only checked in the app. Two users who opened the page before it filled could both join. Fixed with the `enforce_activity_capacity` trigger.
- `leave-activity` failed until `service_role` was granted access to `waitlist`, `activities`, `rsvps`, and `notifications`.

## Feature Workflow

1. A user opens a full activity and taps **Join Waitlist**.
2. A row is added to `waitlist`, and the button changes to **Leave Waitlist (#N)**.
3. On the home feed, the activity card shows a **Waitlist #N** badge.
4. When an attendee leaves, `leave-activity` promotes the first person in line.
5. The promoted user gets "A spot opened up! You're now going to [activity]" as a push and in their notifications.

## Relevant files

- `supabase/migrations/20261006120000_activity_waitlist.sql`: `waitlist` table, RLS policies, grants, and `my_waitlist_positions()`
- `supabase/migrations/20261011120000_activity_capacity.sql`: `enforce_activity_capacity` trigger
- `supabase/functions/leave-activity/index.ts`: removes the RSVP and promotes the next person in line
- `app/activity/[id].tsx`: Join/Leave Waitlist button
- `app/(tabs)/index.tsx`, `components/activity-card.tsx`: Waitlist #N badge on the home feed