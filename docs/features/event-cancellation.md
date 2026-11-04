# Event Cancellation

Hosts can cancel an upcoming activity and add a short explanation. Attendees are notified so they know their plans have changed.

## Cancel an event

1. Open an upcoming activity you host.
2. Choose **Cancel Event** from the three-dot menu.
3. Add an optional reason, up to 500 characters.
4. Confirm **Cancel Event**, or choose **Keep Event** to go back.

Cancellation cannot be undone. The activity stays visible with a cancelled label and the host's reason, but new users cannot join. Deleting an activity is a separate action for hosts who want it removed.

## What the server does

The `cancel-activity` function checks that the caller is the host and the activity can still be cancelled. It saves the cancelled status, reason, and time, then adds attendee notifications and sends pushes where possible.

The join button is hidden for a cancelled activity. A database trigger, `block_rsvp_cancelled`, also rejects joins so an old screen cannot get around that restriction. Related ride handling is covered by the ride-seat and cancelled-activity migration.

## Setup notes

The activity status originally allowed only active and expired. `20261023120000_activity_cancellation.sql` adds cancelled, the reason/time fields, and the join restriction. The server function also needs permission to update activities.

Check `supabase/migrations/20261102120000_ride_seats_and_cancelled_activity_rides.sql` and the current `cancel-activity` function when testing cancellation with linked rides.

## Main files

- `app/activity/cancel/[id].tsx`: reason and confirmation.
- `app/activity/[id].tsx`: cancellation menu and banner.
- `supabase/functions/cancel-activity/index.ts`: checks and cancels the event.
- `components/profile/MyActivities.tsx` and `components/profile/UserProfile.tsx`: cancelled labels in activity lists.

Test as a host and an attendee. Check the confirmation, optional reason, notifications, blocked joining, and any linked rides. Make sure a non-host cannot cancel it.
