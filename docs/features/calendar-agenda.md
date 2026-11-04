# Calendar and Upcoming Plans

The Calendar puts activities and rides together so users can see what they have coming up. Open it from the calendar icon in the header.

## Choose what to show

The default **My activities** view includes activities you created or joined. Switch to **Created**, **Joined**, or **All activities** to change the calendar dots, the selected day's list, and the upcoming agenda together. All activities includes only what your account is allowed to access.

**Include my rides** starts on. It adds your active ride offers and rides where your seat has been accepted. It stays separate from the activity filter. Pending or rejected seats and cancelled or completed rides are not included.

Hosting is marked in amber, other activities in blue, and rides in green. Tap a date to see that day's plans, then tap a plan to open its details. Tap the date again or use **Clear** to remove the day selection.

## Upcoming agenda

Below the calendar, upcoming activities and rides appear in time order, grouped by day. The first 20 plans show initially; **Show more plans** reveals another 20. An activity you both host and joined appears once.

The agenda skips cancelled activities, plans without a usable date, and start times that have already passed. You can still select a past date to see older activities. Completed ride history stays on the Rides screen.

Dates follow the phone's time zone. This matters for late-night events: a plan should appear on the day it happens locally, even if its saved UTC date is the next day.

## Keeping plans up to date

The calendar reloads when you return to it, reopen the app, or pull down to refresh. It listens for changes to activities, attendance, rides, and seat requests while open. It also checks once a minute in case a live update was missed.

If a refresh fails, the last loaded plans stay visible with an error and Retry. Changing accounts clears the old account's work so a late response cannot replace the new calendar.

Campus events appear here after they are hosted as Rollin activities. **Export events** has its own filters and exports activities only; turning rides on in this view does not add them to the export. See [Calendar Export](calendar-export.md).

## Development notes

This feature uses the existing activity and ride tables. It loads all result pages, including attendance and accepted seats, so larger accounts are not cut off by a single database response. It needs no new SQL or API key.

Main files: `app/calendar.tsx`, `lib/calendar-plans.ts`, `services/calendar-plans-service.ts`, and `hooks/use-calendar-plans.ts`.

## Testing

```powershell
node --test scripts/test-calendar-plans.cjs scripts/test-calendar-export.cjs
```

Create an activity, join another, offer a ride, and have a seat accepted on a different ride. Check the filters, ride toggle, calendar dots, and agenda. Change or leave a plan and return to confirm it updates. Use another account to accept a seat while the calendar is open, then test a failed connection and Retry. Include a late-night event and an account with no plans.
