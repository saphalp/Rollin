# Application Architecture

## Architecture Overview

Rollin is a React Native application built with Expo SDK 54 and TypeScript. Expo Router provides navigation, React Native Paper allows for reusable interface components, and Supabase provides authentication and backend services.

The project attempts to follow a component-first structure. Route files define screens and navigation behavior, while reusable elements are placed in `components/`.

A typical data flow is:

User action → screen or component → service → Supabase → updated application state

## Technology Stack

The primary technologies include:

- Expo SDK 54
- React Native 0.81
- React 19
- TypeScript
- Expo Router
- React Native Paper
- Supabase Authentication, Database, Storage, and Realtime
- Expo Location
- React Native Maps
- Expo Notifications
- Expo Image Picker
- MkDocs Material and Read the Docs for developer documentation

## Project Structure

- `app/` contains Expo Router screens and route groups.
- `components/` contains reusable interface components.
- `hooks/` contains reusable React state and data-loading logic.
- `services/` contains backend operations and domain-specific logic, especially for ride sharing.
- `lib/` contains shared infrastructure such as the Supabase client and profile utilities.
- `providers/` contains application-wide context providers.
- `constants/` defines theme colors and typography.
- `types/` contains shared TypeScript data types.
- `navigation/` centralizes navigation helpers for complex flows.
- `supabase/migrations/` stores database migrations currently included in the repository.
- `docs/` contains the source files for the Read the Docs website.

## Routing and Navigation

Expo Router generates routes from files inside `app/`.

Users are separated into three states:

1. Authenticated users with completed profiles that can access the main tabs.
2. Authenticated users with incomplete profiles that are sent to onboarding.
3. Unauthenticated users that are limited to the authentication routes.

The main tab navigator contains:

- Home
- Explore
- Post
- Rides
- Chats
- Profile

Notifications exist and are opened from the global header.
