# Calendar Export

Users can save Rollin activities as a calendar file and import them into Google Calendar or another app that accepts `.ics` files.

## Export events

1. Open **Calendar → Export events**.
2. Choose activities you created, joined, both, or all activities available to you.
3. Choose **Upcoming**, **This month**, **All dates**, or a custom **Date range**.
4. Check the number of matching events, then tap **Export calendar file**.
5. Save or share the file using the phone's share menu.

A custom date range includes both the first and last day. An empty selection cannot be exported. On web, the button downloads the file instead of opening the phone's share menu.

## Add the file to Google Calendar

1. Save the file somewhere you can access on a computer.
2. Open Google Calendar on that computer.
3. Go to **Settings → Import & export**.
4. Choose the `.ics` file and the calendar to add it to, then select **Import**.

See [Google's import instructions](https://support.google.com/calendar/answer/37118) for help with that step.

The file is a copy of the events at export time. Changes or cancellations in Rollin will not update the imported events. Check earlier imports before importing the same plans again, since duplicate handling depends on the calendar app.

## What is included

Each event includes its title, description, location, and start time. Calendar apps display the time in their own time zone. Rollin activities do not have an end-time field, so the export does not invent one.

The export includes activities, not rides. Campus feed entries must first exist as hosted Rollin activities. Joined means an actual RSVP; pending requests and waitlists do not count. An activity you created and joined is included once, and private activity access is still checked.

Opening the export panel loads fresh data. If part of that load fails, export stops with an error instead of saving an incomplete file. Activities with missing or invalid dates are skipped. Exporting does not join activities or send invitations.

## Development notes

No Google API key, Google sign-in setup, or extra Supabase migration is needed. The feature uses `expo-file-system` and `expo-sharing`. A development build made before those modules were added needs rebuilding.

Files are kept in the app's cache long enough for another app to read them after sharing. Exports older than one day are removed during a later export. Copies the user saves elsewhere are separate files.

## Testing

```powershell
node --test scripts/test-calendar-export.cjs
```

Try each event group and date option, an empty result, a failed connection, and cancelling the share menu. Import a file into Google Calendar and compare its dates, times, and locations with Rollin. Check that an activity you both created and joined appears only once.
