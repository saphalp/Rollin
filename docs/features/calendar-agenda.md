# Calendar and upcoming agenda

Open Calendar from the header. The default **My activities** filter combines
activities you created and joined. **Created**, **Joined**, and **All activities**
filter the calendar markers, selected-day list, and upcoming agenda together.
All activities means activities visible through the current user's database permissions.

**Include my rides** is enabled initially. It adds your active ride offers and
rides where your seat request is accepted. It operates independently of the
activity filter. Pending/rejected/canceled seat requests and canceled/completed
rides are excluded. Hosted activities are included without requiring a separate
RSVP, and an activity you both host and joined appears once.

Activities and rides use different icons, labels and marker colors. Hosting is
amber, other activities blue, and rides green. Markers use the device's local
date; multiple plans of the same kind share a dot. Tap a date for that day's
plans; tap it again or select Clear to clear the day selection. Tap an item to
open its activity or ride details.

The upcoming agenda combines activities and rides in chronological order, grouped
by local date. It excludes past start times, missing/invalid dates and canceled
activities. The agenda initially renders 20 items; Show more plans reveals 20
more. Selected past dates can still show historical activities. The calendar is
not a full completed-ride history; that remains on the Rides screen.

## Refresh and data

- Refresh when entering/returning to the screen, resuming the app, or pulling down.
- While focused, subscribe to changes on activities, RSVPs, ride offers and seat
  requests. Debounce bursts and refresh after the subscription reconnects.
- Refresh every minute while focused and foregrounded as a fallback for missed
  events or tables without Realtime enabled. No polling on other screens or in
  the background. This also updates which plans are still upcoming.
- Cancel requests and clean up subscriptions on blur/account changes. Old requests
  cannot overwrite results for a different account or newly focused screen.
- Keep the last successful result during refresh. On failure, show an error and
  Retry; do not silently present a partial calendar as complete.
- Paginate all queries, including memberships and accepted rides. No new RPC,
  migration, dependency or privileged backend key is needed.

Campus events appear here when hosted as activities, matching the existing
calendar source. The standalone campus feed and saved-campus-event work remain
separate. The existing **Export events** dialog retains its own filters and
exports activities; the new ride toggle does not add rides to that file.

## Verification

Run `node --test scripts/test-calendar-plans.cjs scripts/test-calendar-export.cjs`.
The tests cover filtering, accepted/owned rides, pagination, deduplication, local
dates, detail routes, membership changes, refresh triggers, failures, account
changes, and subscription cleanup.

Device acceptance:

1. Create an activity, join another, offer a ride, and get an accepted seat in a
   different ride. Confirm all appear in My activities with rides enabled.
2. Switch Created, Joined and All activities; verify both markers and agenda.
   Disable rides and verify they disappear from both.
3. Tap activity/ride cards and return. Leave an activity, cancel a request, or
   change a plan's time. Confirm the updated membership/date on return.
4. From another account, accept a request or cancel a ride while the calendar is
   open. Verify Realtime refresh, or the within-a-minute fallback if disabled.
5. Test empty accounts, offline Retry, past selected days, midnight events, large
   text, export, and the calendar tutorial highlight.

Files: `app/calendar.tsx`, `lib/calendar-plans.ts`,
`services/calendar-plans-service.ts`, `hooks/use-calendar-plans.ts`.
