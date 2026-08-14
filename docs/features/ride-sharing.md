# Ride Sharing

## Purpose

## Assumptions

## Decisions

## Technical Hurdles

## Feature Workflow

## Interface Details

## Relevant Files

| File | Role |
|---|---|
| `app/(tabs)/rides.tsx` | Main ride dashboard for discovery, offers, requests, and history |
| `app/ride/offer.tsx` | Creates standalone or activity-linked ride offers |
| `app/ride/request.tsx` | Creates standalone or activity-linked wanted-ride requests |
| `app/ride/available.tsx` | Lists and filters available offers and wanted-ride requests |
| `app/ride/[id].tsx` | Displays ride details and manages passenger requests and ride status |
| `app/ride/find.tsx` | Lists upcoming ride-enabled activities |
| `app/ride/map.tsx` | Displays the full-screen ride discovery map |
| `app/activity/[id].tsx` | Provides ride-sharing entry points from an activity |
| `navigation/ride-navigation.ts` | Centralizes navigation to ride search, details, and tracking routes |
| `components/rides/ride-action-cards.tsx` | Presents Find a Ride and Offer a Ride actions |
| `components/rides/ride-dashboard-cards.tsx` | Renders offer, request, and history cards on the ride dashboard |
| `components/rides/attending-activity-picker-sheet.tsx` | Selects an attended activity before finding or offering a ride |
| `components/rides/available-ride-card.tsx` | Displays an available ride offer |
| `components/rides/wanted-ride-card.tsx` | Displays a rider's wanted-ride request |
| `components/rides/ride-detail-card.tsx` | Displays route, driver, activity, seating, and timing details |
| `components/rides/ride-request-button.tsx` | Controls passenger request and cancellation actions |
| `components/rides/ride-filter-bar.tsx` | Filters all, activity-linked, and standalone rides |
| `components/rides/offer/offer-ride-form.tsx` | Reusable form shared by ride offers and wanted requests |
| `components/activity/activity-ride-options-sheet.tsx` | Presents ride options associated with a specific activity |
| `hooks/use-available-rides.ts` | Loads and refreshes filtered ride offers |
| `hooks/use-ride-dashboard-data.ts` | Loads the signed-in user's offers, requests, and ride history |
| `hooks/use-ride-request.ts` | Manages a passenger's request for a specific ride |
| `hooks/use-ride-wanted-requests.ts` | Loads wanted-ride requests and listens for changes |
| `hooks/use-attending-activities.ts` | Loads activities available for ride linking |
| `services/rides-service.ts` | Fetches ride offers and subscribes to offer changes |
| `services/ride-requests-service.ts` | Creates, cancels, and subscribes to passenger ride requests |
| `services/offerer-ride-requests-service.ts` | Lets drivers load, accept, and decline passenger requests |
| `services/ride-wanted-requests-service.ts` | Creates, cancels, fulfills, and subscribes to wanted rides |
| `services/ride-dashboard-service.ts` | Fetches dashboard and ride-history data |
| `services/ride-lifecycle-service.ts` | Starts, completes, and cancels offered rides |
| `services/geocoding-service.ts` | Converts pickup and destination text into coordinates |
| `types/rides.ts` | Defines shared ride, request, location, and status types |
