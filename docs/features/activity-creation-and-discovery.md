# Activity Creation and Discovery

## Purpose

Allow users to create activities for other students to join, and discover activities posted by others. Discovery respects privacy settings — public activities are visible to everyone, while private activities are only visible to the host's followers. A calendar view lets users see all upcoming activities across any month.

## Assumptions

- Every activity must have a title, category, location, and date/time before it can be posted.
- A location string is geocoded to latitude/longitude at creation time so the activity can later appear on a map.
- Activity images are optional. If no image is uploaded, a category-based placeholder image is shown.
- Private activities are discoverable on the Explore feed (anyone can browse them), but joining requires the host to accept a request.
- The calendar shows all activities regardless of privacy — the intent is to give users a full picture of what is happening.

## Decisions

- **Image upload via FormData to the Supabase Storage REST API directly** — the Supabase JS SDK's `upload()` method failed in React Native because it requires an `ArrayBuffer`, which is not reliably available in the RN environment. Posting a `FormData` object with the local file URI directly to the Storage REST endpoint works around this.
- **`event_type` column (`public` / `private`) instead of a boolean** — a string enum leaves room for future types (e.g. `invite-only`) without a migration.
- **`ride_sharing` boolean column** — replaced an earlier `rides_available` integer. A simple boolean is enough for the current feature set.
- **Social graph filter on the home feed using the `follows` table** — private activities are filtered server-side using a Supabase `.or()` query that checks `event_type = public OR (event_type = private AND host_id IN (followed_ids))`. This keeps the logic in one query rather than fetching everything and filtering client-side.
- **Calendar fetches all activities with no date range filter** — an earlier per-month fetch was causing activities near month boundaries to disappear due to UTC/local timezone mismatches. Fetching everything once on screen open and using the device's local timezone for date keys (`localDateKey()`) is simpler and more reliable.

## Technical Hurdles

- **Image upload producing empty files** — `fetch(localUri).blob()` and `base64 → ArrayBuffer` decode both silently produced empty uploads in React Native. Fixed by using `FormData` with the raw local URI posted to the Supabase Storage REST API with an `Authorization` header and `x-upsert: true`.
- **Activity delete blocked silently by RLS** — Supabase returned 0 rows deleted with no error because the `activities` table had no `DELETE` RLS policy. Fix: added `CREATE POLICY "Hosts can delete their activities" ON public.activities FOR DELETE USING (auth.uid() = host_id)`, and also delete related `rsvps` rows first to avoid a foreign-key constraint failure.
- **Calendar dots appearing on the wrong day** — `date_time` is stored in UTC. Slicing the first 10 characters of the ISO string gave the UTC date, not the local date. For example, an activity at 10 PM EST (Nov 30) was stored as Dec 1 UTC, making its dot appear on Dec 1 in the calendar. Fixed with a `localDateKey()` helper that uses `getFullYear()`, `getMonth()`, and `getDate()` to build the key from local time.
- **Geocoding on Android requiring explicit permission** — `expo-location`'s `geocodeAsync` requires foreground location permission on Android before it will run. Added a permission request step with a user-facing explanation before calling the geocoder.

## Feature Workflow

**Creating an activity:**
1. User opens the Post tab.
2. Fills in title, description, category (pill selector), location (text), date/time, max attendees, event type (public/private), and ride sharing toggle.
3. Optionally picks a photo from their library.
4. Taps "Create Activity":
   - If an image was selected, it is uploaded via `FormData` to `activity-images` storage bucket; the returned public URL is saved as `image_url`.
   - The location string is geocoded to `latitude`/`longitude` via `expo-location`.
   - A row is inserted into the `activities` table with all fields.
5. On success the form resets and the user is returned to the home feed.

**Editing an activity:**
1. Host opens the activity detail screen and taps "Edit".
2. All fields are pre-filled from the existing activity row.
3. Host can change any field, including swapping the hero image.
4. Save triggers the same FormData upload (if image changed) and an `update` on the `activities` row.

**Deleting an activity:**
1. Host taps "Delete" on the activity detail screen.
2. A confirmation alert is shown.
3. On confirm, all `rsvps` rows for that activity are deleted first, then the `activities` row is deleted.
4. The user is navigated back.

**Discovering activities (Home feed):**
1. On load, the app fetches the current user's followed users from the `follows` table.
2. Activities are queried: public ones for everyone, plus private ones whose `host_id` is in the followed list.
3. The first result becomes the "Featured" card; the rest appear as "Recommended for you".
4. Category pills filter by category; the search bar filters by title client-side.

**Exploring activities (Explore feed):**
1. All activities are fetched regardless of `event_type` — Explore is the discovery surface where users can browse private activities before deciding to request access.
2. Each card shows the host's avatar, name, post time, category, description, and event image.

**Calendar view:**
1. Opened from the calendar icon in the global header (top-right, next to the notification bell).
2. All activities are fetched once on open with no date filter.
3. Dates with activities show colored dots: yellow (`#fea619`) for the user's own hosted events, blue for others'.
4. Tapping a date shows a list of that day's events below the calendar; tapping an event navigates to its detail screen.

**Activity detail:**
1. Shows hero image, title, host (tappable → host profile), date, time, location, capacity, ride sharing badge.
2. "Who's joining" collapsible section lists attendees (avatar + name, tappable → their profile).
3. Non-hosts can join (public) or request to join (private); hosts see Edit and Delete buttons.

## Interface Details

- **Hero image**: full-bleed background with a dark overlay so text is always readable. Falls back to a category-specific placeholder from picsum.photos.
- **Category pills**: horizontal scroll row on both the home feed and the post form.
- **Attendee count**: shown as `joined / max` throughout (feed cards, detail screen, calendar event rows).
- **Dot colors on calendar**: yellow = your event, blue = someone else's event. A legend is shown below the calendar grid.

## Relevant Files

| File | Role |
|---|---|
| `app/(tabs)/post.tsx` | Activity creation form |
| `app/(tabs)/index.tsx` | Home feed with featured + recommended sections |
| `app/(tabs)/explore.tsx` | Explore feed (all activities, unfiltered) |
| `app/activity/[id].tsx` | Activity detail screen (RSVP, join request, attendees, edit, delete) |
| `app/activity/edit/[id].tsx` | Activity edit form |
| `app/calendar.tsx` | Calendar view with per-day activity list |
| `components/activity-card.tsx` | Card used in the home feed recommended section |
| `components/explore/explore-post-card.tsx` | Card used in the Explore feed |
| `components/Header.tsx` | Global header with calendar icon button |
