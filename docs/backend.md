# Backend

## Backend Overview

Rollin uses Supabase as its primary backend. Supabase provides authentication, a PostgreSQL database, file storage, realtime database, and database functions.

Rollin connects to Supabase using a public project URL and publishable key. Authorization is enforced by Supabase policies and database rules rather than by trusting through Rollin's interface itself.

## Supabase Authentication

Supabase Authentication manages account creation, login, email confirmation, Google OAuth, password recovery, session persistence, and logout.

After authentication, Rollin loads the matching row from the `profiles` table. The profile contains application-specific information that does not belong directly in the authentication record, including:

- Full name
- University
- Major
- Profile-picture URL path
- Educational-email verification state
- Profile-completion state

The authentication provider uses the profile-completion value to decide whether the user should enter onboarding or the main application.

## Database Tables and Relationships

The current tables used within Rollin include:

- `profiles` stores application profiles associated with authenticated users.
- `activities` stores activities and references the hosting profile.
- `rsvps` connects users to activities they have joined.
- `activity_join_requests` stores pending, accepted, or rejected private-activity requests.
- `follows` connects follower and followed profiles and stores request status.
- `interests` stores available interest choices.
- `profile_interests` connects profiles to selected interests.
- `conversations` stores direct and activity-group conversations.
- `conversation_participants` connects users to conversations.
- `messages` stores messages associated with a conversation and sender.
- `notifications` stores in-app notifications and related actors or activities.
- `rides_offered` stores ride offers and their drivers.
- `ride_requests` connects passengers to offered rides.
- `ride_wanted_requests` stores requests from users looking for a ride.
- `ride_locations` stores the latest live location for an active ride.

## Image Storage

Rollin currently uses Supabase Storage for uploaded images.

The `avatars` bucket stores profile pictures. Profile records store the uploaded object path, and helper functions convert that path into a public URL.

The `activity-images` bucket stores activity images. The resulting image URL is stored with the activity record.

## Realtime Features

Supabase Realtime is used for features that need to update without manual refreshing, including:

- Chat messages
- Notifications
- Follow-state changes
- Ride offers and requests
- Ride dashboard information
- Live driver locations
