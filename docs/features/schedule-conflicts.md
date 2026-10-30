# Schedule conflict warnings

When a user selects **Join Activity** or **Request to Join** on an activity,
Rollin checks the activity's current start time against activities the user has
already joined or is hosting.

A **Possible schedule conflict** dialog appears when another start time is
within **60 minutes before or after**, including exactly 60 minutes. The dialog
shows the activity being joined, the conflicting activity names, local dates
and times, and whether the user is hosting or attending each one.

- **Go back**, including Android's back button, closes the dialog without joining
  or submitting a request.
- **Join anyway** submits the normal public RSVP. For a private activity,
  **Request anyway** submits a pending request; it does not bypass host approval.
- With no conflicts, the normal join/request proceeds without an extra popup.
- Existing capacity and database permission checks still apply.

This is a start-time proximity warning, not an exact duration/overlap calculation.
For example, starts at 2:00 PM and 3:00 PM warn; 2:00 PM and 3:01 PM do not. Date
comparison uses absolute timestamps, so midnight, offsets and daylight-saving
changes do not change the 60-minute rule. Displayed times include the local time
zone abbreviation.

## Scope and failures

The check uses saved RSVPs and hosted activities, not pending join requests,
waitlist entries, saved events or rides. It excludes the target activity itself,
canceled activities and invalid/missing dates in the user's existing schedule.
An activity the user both hosts and joined appears once. Recently started
activities remain eligible even if the expiry job marked them expired, because
they may still be taking place.

Leaving an activity does not run this check. Waitlist entry and automatic
promotion, as well as a host accepting a previously submitted private request,
do not show this dialog. Private requests are checked when the attendee submits
the request, not at the later time of approval. Standalone campus feed events
are not joined directly; their hosted activities use the same activity flow.

The app reads the current target start and only commitments within the relevant
window, paginating as necessary with the signed-in user's existing permissions.
If the check fails, it reports an error and does not silently join. The user can
try joining again. An activity with no valid start time must be corrected by its
host before joining. Leaving the screen or switching accounts cancels a pending
check/confirmation. Duplicate taps cannot submit duplicate joins.

The warning is advisory and reflects the schedule at the time of checking. It
does not reserve a spot or prevent later schedule changes. No migration, Edge
Function deployment, new dependency or Supabase configuration is needed.

## Verification

Run `node --test scripts/test-schedule-conflicts.cjs`.

Phone acceptance:

1. Join activity A at 2:00 PM. Try joining B at 2:30 PM: verify A's name/time,
   choose Go back, and confirm no RSVP was created.
2. Try B again and choose Join anyway. Verify normal attendance/chat behavior.
3. Try activities exactly 60 minutes earlier/later, then 61 minutes away.
4. Repeat with an activity you host and with a private target. Request anyway
   should show Request Pending and still require the host to accept.
5. Leave a joined activity: no warning. Try an activity on another day and
   verify no false conflict. Test an event spanning a local midnight boundary.
6. Test an empty schedule, network failure/retry, repeated taps, Android back,
   large text and more than one conflicting activity.

Implementation: `lib/schedule-conflicts.ts`,
`services/schedule-conflicts-service.ts`, `hooks/use-schedule-conflict.ts`,
`components/activity/schedule-conflict-dialog.tsx`, and `app/activity/[id].tsx`.
