# Calendar export

Open **Calendar → Export events**. Select events you created, events you joined,
either group combined, or all events available to you on the Rollin calendar.
Combine that choice with **Upcoming**, **This month**, **All dates**, or a custom
**Date range**. The custom range includes both dates in the device's time zone.
The panel shows the matching count before exporting; empty selections cannot be exported.

On iOS and Android, **Export calendar file** opens the system share sheet. Save
the `.ics` file or share it to a destination you choose. On web it downloads a file.
Canceling the share sheet does not add anything to a calendar.

## Import into Google Calendar

1. Save the exported file where you can access it on your computer.
2. Open Google Calendar on a computer.
3. Open **Settings → Import & export → Import**.
4. Select the `.ics` file and destination calendar, then select **Import**.

This is a snapshot, not an ongoing subscription or two-way sync. Later activity
edits, cancellations and membership changes do not update imported events.
Review existing imports before repeatedly importing the same events. Rollin uses
stable event identifiers but duplicate handling depends on the receiving calendar.

## Scope and behavior

- Data comes from the same `activities` table as the calendar. Separate campus
  feed entries are not exported unless they also exist as activities on this calendar.
- Created events match the signed-in user's `host_id`. Joined events use their
  `rsvps` records, not pending requests or waitlist entries. The combined option
  deduplicates activities the user both hosts and has joined.
- All events means all activities accessible through the user's existing database
  permissions. It does not grant access to private events.
- Export loads fresh, paginated activity and membership data when the panel opens.
  A failed page blocks export rather than silently producing a partial file.
- Missing or invalid dates are excluded. Upcoming starts at the time the panel
  opened; This month uses the current device-local calendar month.
- Files contain title, description, location/address and UTC start time. Calendar
  apps display the instant in their own time zone. Activities have no end-time
  field, so the file omits an end time instead of inventing a duration.
- Exporting does not create RSVPs, change activities, or send invites.
- Native files live in the app's cache so receiving apps can read them after the
  share sheet closes. Exports older than one day are removed on a subsequent
  export; the operating system can also clear the cache. Copies saved or shared
  by the user are outside Rollin's control.

## Setup and validation

No new Supabase queries to run, migration, Google API key, OAuth configuration,
or paid service is needed. Run `npm install` after pulling the code. The feature
uses SDK-compatible `expo-file-system` and `expo-sharing`; existing custom native
development builds need rebuilding to include the sharing module. Expo Go includes
these modules when its SDK version matches the project.

Automated checks: `node --test scripts/test-calendar-export.cjs`.
Manually test each scope and date option, an empty selection, an offline retry,
and share-sheet cancellation. Import a saved file into Google Calendar on a
computer and compare titles, locations and times with Rollin. Check one event
you both created and joined appears only once in the export.

References: [Google import instructions](https://support.google.com/calendar/answer/37118),
[iCalendar format](https://www.rfc-editor.org/rfc/rfc5545),
[Expo Sharing](https://docs.expo.dev/versions/v54.0.0/sdk/sharing/).
