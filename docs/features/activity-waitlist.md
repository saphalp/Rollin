# Activity Waitlist

When an activity is full, users can join its waitlist. If someone leaves, the first person waiting is moved into the activity and notified.

## Joining the list

Open a full activity and tap **Join Waitlist**. The button changes to **Leave Waitlist (#N)** so the user can see their place and leave if their plans change. The Home card also shows their waitlist position.

The list is first come, first served. Each person can join once and can see their own position, not the names of everyone waiting.

## When a spot opens

Leaving an activity calls the `leave-activity` server function. It removes the attendee, checks for a free spot, and adds the next waiting person to the activity. It removes that person from the waitlist and sends an in-app notification and, where available, a push.

This happens on the server so it can finish even if the person leaving closes the app. Positions are calculated from join times, so the list does not need to be renumbered each time someone leaves.

## Keeping capacity correct

We once saw an activity with two attendees even though its limit was one. Both users had opened the page before the final place was taken, and the app's local check was not enough.

The `enforce_activity_capacity` database trigger now rejects joins when the activity is full. The app shows **This activity is full. Join the waitlist instead.** Server permissions also need to allow `leave-activity` to update attendance, waitlists, and notifications.

## Main files

- `supabase/migrations/20261006120000_activity_waitlist.sql`: waitlist table and `my_waitlist_positions()`.
- `supabase/migrations/20261011120000_activity_capacity.sql`: capacity checks.
- `supabase/functions/leave-activity/index.ts`: leaving and filling the opened spot.
- `app/activity/[id].tsx`: Join/Leave Waitlist controls.
- `components/activity-card.tsx`: the waitlist badge on Home.

Test a full activity with two waiting accounts. Have an attendee leave and check that the first person gets the spot, the second person's position updates, and the activity stays within capacity.
