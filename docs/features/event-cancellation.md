# Event Cancellation

## Purpose

Hosts can cancel an upcoming event and explain why. Everyone who joined is notified automatically, so nobody shows up to an event that isn't happening.

## Assumptions

- Only the host can cancel, and only an upcoming event that isn't already cancelled.
- The cancellation message is optional, up to 500 characters.
- Cancelling can't be undone.
- Cancelled events stay visible so attendees can see what happened, but nobody can join them.

## Decisions

### Cancel instead of delete

Cancelling sets the activity's `status` to `cancelled` and saves `cancel_reason` and `cancelled_at`, instead of deleting the row. This keeps the event on attendees' profiles with a clear "Cancelled" label, and they can still open it to read the host's message. Delete Activity is still available for hosts who want the event gone entirely.

### Edge function does the work

The `cancel-activity` edge function verifies the caller is the host, marks the event cancelled, adds an in-app notification for every attendee, and sends them a push with the event name and message. Notifying other users and updating the activity need the service-role key, so this can't run in the app.

### Blocked in the database

A trigger on `rsvps` (`block_rsvp_cancelled`) rejects any join on a cancelled activity. The Join button is also hidden, but the trigger makes sure an old screen or a direct request can't get around it.

### Confirmation before cancelling

Since cancelling can't be undone and notifies everyone, the app asks "Cancel this event?" with **Keep Event** and **Cancel Event** options before doing anything.

## Technical Hurdles

- The `status` column only allowed `active` and `expired`. The migration removes the old check and adds one that also allows `cancelled`.
- The function needed `update` on `activities` for `service_role`.

## Feature Workflow

1. The host opens an upcoming event and taps **⋮ → Cancel Event**.
2. They optionally write a reason, tap **Cancel Event**, and confirm.
3. `cancel-activity` marks the event cancelled and notifies every attendee.
4. Attendees get a push like "Board Game Night was cancelled: Rain," and the same message in their Notifications tab.
5. The activity page shows a red "This event was cancelled" banner with the reason, and the Join button is gone.
6. On profiles, the event shows a red **Cancelled** label in the Created and Joined lists.

## Relevant files

- `supabase/migrations/20261023120000_activity_cancellation.sql`: `cancelled` status, `cancel_reason` and `cancelled_at` columns, `block_rsvp_cancelled` trigger, grants
- `supabase/functions/cancel-activity/index.ts`: verifies the host, cancels the event, notifies attendees
- `app/activity/cancel/[id].tsx`: cancel screen with the optional message and confirmation
- `app/activity/[id].tsx`: Cancel Event menu item, cancelled banner, hides Join
- `components/profile/MyActivities.tsx`, `components/profile/UserProfile.tsx`: Cancelled label on profile lists