# Supabase and App Data

Rollin uses Supabase for accounts, the database, uploaded images, and live updates. The app connects with the project URL and publishable key in `.env.local`.

The database decides what each user can read or change. Hiding a button in the app is useful, but it cannot replace those checks. Supabase calls its table access rules **row-level security**, or **RLS**.

## Accounts and profiles

Supabase Auth handles signup, passwords, Google sign-in, saved sessions, and logout. The `profiles` table stores the app-specific details: name, university, major, pictures, and verification badges.

The app loads that profile after login checks are complete. If required details are missing, it opens profile setup before the main tabs. Our separate emailed login-code feature is explained in [Email Login Verification](features/login-email-verification.md).

## Main tables

| Tables | What they store |
|---|---|
| `profiles`, `interests`, `profile_interests` | Profile details and selected interests |
| `follows` | Follow requests and accepted connections |
| `activities`, `rsvps`, `activity_join_requests` | Activities, attendees, and requests to join private activities |
| `activity_photos`, `activity_photo_images`, `post_likes` | Explore posts, their photos, and likes |
| `conversations`, `conversation_participants`, `messages` | Chats, their members, and message history |
| `conversation_read_state`, `conversation_delivery_state` | How far each member has read or received messages |
| `notifications` | Updates shown inside the app |
| `rides_offered`, `ride_requests` | Rides offered by drivers and passenger seat requests |
| `ride_wanted_requests` | Posts from people looking for a ride |
| `ride_locations` | The latest shared location for a ride |
| `ride_ratings`, `host_reviews` | Reviews after rides and activities |
| `reports` | Reports for the moderation dashboard |

This is a guide to the main tables, not a complete database definition. Some older tables and functions were created through the Supabase dashboard. The migration folder alone may not recreate the whole project; check the feature's setup notes when starting a new backend.

## Uploaded images

- `avatars` holds profile and cover pictures. Profile rows store the file paths.
- `activity-images` holds the main images on activities.
- `activity-photos` holds photos shared through Explore.

The app currently uses public image URLs in these areas. Restricting a database row does not make an already shared image URL private. See [Explore Posts on Activities](features/activity-explore-posts.md) for that limitation.

## Live updates

Supabase Realtime tells the app when messages, notifications, ride details, and other subscribed data change. Screens also reload when reopened, and some check periodically in case an update was missed.

Server tasks live in `supabase/functions/`. These are called **Edge Functions** in Supabase. They handle work that should not run with a user's app permissions, such as sending email or notifying other people. Server secrets stay in Supabase.

## Changing the backend

A migration is a saved SQL file that changes tables, functions, or access rules. It is separate from an app release. Applying SQL to the shared project affects everyone using it, so follow the feature's instructions and confirm which changes are already installed. Do the same for Edge Function deployments.
