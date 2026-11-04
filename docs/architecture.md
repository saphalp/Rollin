# How the App Is Organized

Rollin is built with React Native, Expo, and TypeScript. Expo Router handles moving between screens. Supabase handles accounts, stored data, uploaded files, and live updates.

For example, when someone requests a ride, the screen calls a service, the service sends the request to Supabase, and the screen updates when it gets the result.

## Main tools

- **React Native and Expo:** build and run the mobile app. The current project uses Expo SDK 58 and React Native 0.88; check `package.json` for exact versions.
- **TypeScript:** checks the types used throughout the app.
- **Expo Router:** turns the files in `app/` into screens and routes.
- **React Native Paper:** provides shared interface components.
- **Supabase:** stores data and handles authentication, file uploads, and live updates.
- **Expo Location and React Native Maps:** support location and map features.
- **Expo Notifications:** handles device notifications.
- **MkDocs Material and Read the Docs:** build and host this documentation.

## Where things go

| Folder | What is in it |
|---|---|
| `app/` | Screens and navigation |
| `components/` | Parts of the interface used by screens, such as cards, buttons, and forms |
| `hooks/` | Shared React logic for loading data and managing state |
| `services/` | Requests to Supabase and other work shared by screens |
| `lib/` | Helpers such as the Supabase connection and date calculations |
| `providers/` | Information shared across the app, such as the signed-in account |
| `constants/` | Colors, fonts, and other shared values |
| `types/` | TypeScript types used in more than one file |
| `navigation/` | Helpers for opening screens with the right details |
| `supabase/migrations/` | SQL files that change the database |
| `supabase/functions/` | Server functions for tasks such as sending emails and planning routes |
| `scripts/` | Tests and development tools |
| `docs/` | These documentation pages |

## Moving through the app

People who are signed out see the login and signup screens. After signing in, the app checks whether a login code is needed, then whether the profile is complete. Once those steps are finished, it opens the main app.

The bottom tabs are Home, Explore, Post, Rides, Chats, and Profile. The calendar and notifications open from the header. Activity details, ride details, and other pages open on top of those tabs.

We try to keep screen files focused on arranging the page and handling navigation. Shared interface pieces belong in `components/`, and shared data requests belong in hooks or services. Some older screens still do more of that work themselves.
