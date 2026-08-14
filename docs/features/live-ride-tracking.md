# Live Ride Tracking

## Purpose

## Assumptions

## Decisions

## Technical Hurdles

## Feature Workflow

## Interface Details

## Relevant Files

| File | Role |
|---|---|
| `app/ride/tracking/[id].tsx` | Authorizes participants and presents the live-tracking screen |
| `components/rides/live-ride-map.tsx` | Resolves the platform-specific live-map implementation |
| `components/rides/live-ride-map.native.tsx` | Displays driver, passenger, pickup, and destination markers on native maps |
| `components/rides/live-ride-map.web.tsx` | Provides a web fallback when the native map is unavailable |
| `components/rides/live-ride-status.tsx` | Displays distance, approximate ETA, arrival, and stale-location status |
| `hooks/use-live-ride-location.ts` | Coordinates location publishing, subscriptions, passenger location, ETA, and arrival notifications |
| `services/ride-tracking-service.ts` | Requests permission, publishes and subscribes to locations, and calculates distance and ETA |
| `services/ride-requests-service.ts` | Verifies that only the driver and accepted passengers can access tracking |
| `services/ride-lifecycle-service.ts` | Updates rides through open, in-progress, completed, and cancelled states |
| `services/ride-notifications-service.ts` | Configures and sends the driver-arrival notification |
| `navigation/ride-navigation.ts` | Opens the dynamic live-tracking route |
| `types/rides.ts` | Defines the shared coordinate and live-location types |
| `supabase/migrations/20260804_sprint3_live_tracking` | Creates the live-location table, access policies, and realtime publication |
