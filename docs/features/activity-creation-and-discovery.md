# Activities and Discovery

Activities are the main way students make plans in Rollin. Someone posts what they want to do, and other students can join, talk in the group chat, and arrange a ride.

## Create or edit an activity

1. Open **Post**.
2. Fill in the title, category, location, date, time, and capacity. Add a description and photo if needed.
3. Choose public or private, and whether ride sharing is available.
4. Tap **Create Activity**. After it saves, the form clears and the app returns to Home.

An activity must have a valid date and time. Hosts can open their activity and choose Edit to change its details or image. The app also saves location coordinates so the activity can appear on a map.

## Find something to do

**Home** shows public activities and private activities from followed hosts. Use the category buttons or title search to narrow the list. The Featured carousel highlights three activities, with more listed under Recommended for you.

Featured ranking considers attendance, saves, views, and ride availability. Activities with open spots come before full ones, and only activities that have not started qualify. If the ranking request fails, Home falls back to date order.

**Explore** is the photo-post feed. Users can see posts linked to activities and tap the activity tag to open the event. Its results follow post and author privacy rules. See [Explore Posts on Activities](activity-explore-posts.md).

The calendar shows your plans by date and includes filters for created, joined, and all accessible activities. It can also show your rides. See [Calendar and Upcoming Plans](calendar-agenda.md) and [Calendar Export](calendar-export.md).

## Open and join an activity

The detail page shows the host, date, time, location, capacity, and description. You can open the host's profile or expand the attendee list to see who is going.

Public activities can be joined directly. Private activities need the host to accept a request. Before joining, Rollin checks for [other plans within 60 minutes](schedule-conflicts.md) and lets the user decide whether to continue.

Full activities can have a [waitlist](activity-waitlist.md). Hosts can [send announcements](activity-announcements.md) and [cancel an event](event-cancellation.md). Activities with ride sharing enabled show [ride options](ride-sharing.md), and tagged photos appear in the Explore posts section.

## Things we had to fix

Early photo uploads sometimes produced empty files on React Native. The activity form uploads through the Supabase Storage API using `FormData` rather than the upload approach that caused that problem.

Calendar dots also used to appear on the wrong day for some late-night activities. The database saves times in UTC, but the calendar now groups them using the phone's local date.

On Android, converting a typed location into coordinates needs location permission. The form asks before making that request.

## Development notes

Activities are stored in `activities`; attendees are linked through `rsvps`. Private requests use `activity_join_requests`. `event_type` stores public/private, and `ride_sharing` controls the activity's ride options. Older ride screens also use `rides_available`, so check both uses before removing either field.

`supabase/migrations/202610130001_require_activity_date.sql` enforces dates for new activities and date changes. Older undated activities need their hosts to set a date.

Featured scoring is defined in `20261021130000_featured_activity_scores.sql`: 3 points per attendee, 2 per save, 0.5 per unique viewer, 3 for ride sharing, and 2 per qualifying rider. Ties favor the earlier activity. `record_activity_view` records one view per user and activity, excluding the host. The ranking function returns totals for eligible activities rather than exposing individual saves or views.

## Main files

| File | What it does |
|---|---|
| `app/(tabs)/post.tsx` | Creates activities |
| `app/(tabs)/index.tsx` | Home feed and filters |
| `components/home/featured-carousel.tsx` | Featured activity carousel |
| `app/(tabs)/explore.tsx` | Photo-post feed |
| `app/activity/[id].tsx` | Activity details and joining |
| `app/activity/edit/[id].tsx` | Host editing |
| `app/calendar.tsx` | Calendar and upcoming plans |
