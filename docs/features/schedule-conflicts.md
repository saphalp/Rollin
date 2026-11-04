# Schedule Conflict Warnings

Rollin warns users when an activity they want to join starts close to another activity they already joined or are hosting. They can still join if the timing works for them.

## When the warning appears

The check runs when someone taps **Join Activity** or **Request to Join**. If another activity starts within 60 minutes before or after it, the **Possible schedule conflict** popup shows the conflicting names, dates, and times.

For example, activities starting at 2:00 PM and 3:00 PM trigger a warning. Activities starting at 2:00 PM and 3:01 PM do not. We compare start times because activities do not have a saved end time; this is not a calculation of their full duration.

- **Go back** closes the popup without joining. Android's back button does the same.
- **Join anyway** continues with a public activity.
- **Request anyway** sends a private activity request that still needs the host's approval.

If there is no conflict, joining continues normally. Capacity and access checks still apply.

## What gets checked

The check includes hosted activities and saved RSVPs. It does not include rides, saved events, waitlists, or pending join requests. Cancelled activities and missing dates are skipped, and an activity that is both hosted and joined appears once.

A recently started activity can still trigger the warning because it may be taking place. Times are compared as actual moments, so crossing midnight or a daylight-saving change does not alter the 60-minute rule. The popup shows local times.

Leaving an activity does not show a warning. Joining a waitlist, being moved off a waitlist, or having a host approve an earlier request also does not run it. Private requests are checked when they are sent.

## If the check fails

The app reads the latest start time before joining. If it cannot load the schedule, it shows an error and asks the user to try again. If the activity has no valid date, the host needs to fix it first.

Leaving the page or changing accounts cancels the check. Repeated taps cannot submit the same join while the warning is open. The check does not reserve a spot or prevent someone changing an event later.

## Development and testing

No new SQL, server function, or API key is needed. The main files are `lib/schedule-conflicts.ts`, `services/schedule-conflicts-service.ts`, `hooks/use-schedule-conflict.ts`, and `components/activity/schedule-conflict-dialog.tsx`.

```powershell
node --test scripts/test-schedule-conflicts.cjs
```

Test activities 30, 60, and 61 minutes apart. Try Go back and Join anyway, then repeat with a hosted activity and a private request. Also check an empty schedule, a connection failure, multiple conflicts, larger text, and events on either side of midnight.
