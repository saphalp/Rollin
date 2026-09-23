# Road Routing and Passenger Pickups

## Purpose

Rollin plans the stops for a ride and lets passengers see the planned route. Drivers use Google Maps for navigation rather than following directions inside Rollin.

## Assumptions

- The driver grants location permission
- Each accepted passenger has an approved pickup address
- The ride has a destination with saved coordinates
- The routing function and ORS key are configured in Supabase
- Background tracking is not available yet

## Decisions

### Pickup choices

The ride offerer can choose a shared meetup location or turn on individual passenger pickups. For individual pickups, each passenger must include an address with their request. Passengers can also request a different address for a ride with a shared meetup spot.

The driver sees the requested address before accepting. Acceptance approves that address. Changing an approved address requires cancelling and requesting again.

### Route planning

The route starts at a fresh driver location, visits the remaining pickups, and ends at the ride destination. Rollin uses an ORS distance matrix to find the lowest-distance pickup order for up to 10 passengers. This finds the best order for the road distances ORS returns; it does not guarantee that every road segment is the shortest possible one.

Drivers can move pickups up in the list. That order is saved until they choose to recalculate it. Marking a passenger picked up removes that passenger from the remaining plan.

### Google Maps

Start Drive opens the route overview. The driver reviews the stops, then taps Open Google Maps to navigate with the stops already filled in. Google Maps calculates its own roads, so its route may differ from the overview in Rollin. If Google Maps is not installed, the link opens in a browser.

The link includes up to three intermediate stops plus the destination. For longer trips, the driver is told that navigation will open one stop at a time. Navigate to next stop always opens only the next pickup or destination.

### Passenger tracking

Passengers load the driver's saved route from Supabase. Their refresh button does not call ORS. Distances are shown in miles.

Location sharing runs while Rollin is open. It pauses when the driver switches to Google Maps and resumes when they return. Passengers see the last update time and a stale-location message rather than assuming an old position is live. Background sharing will be added after the development build is ready.

## Feature Workflow

1. The driver posts a ride with a destination and pickup choice
2. Passengers request seats and provide alternate pickup addresses if needed
3. The driver reviews and accepts the requests
4. The driver presses Start Drive on Ride Details
5. Rollin displays the route from the driver's current location. The driver taps Open Google Maps when ready
6. At a pickup, while parked, the driver returns to Rollin and presses Picked up for that passenger
7. Rollin updates the remaining route. Open Google Maps starts navigation again
8. After reaching the destination, the driver returns to Rollin and taps Complete ride on the overview
9. The driver and passengers can rate each other

## Technical Hurdles

### API calls

Planning an unordered trip with multiple pickups uses one matrix request and one directions request. Refreshing an already ordered trip uses a directions request. Moving the car marker does not request a new road route.

### Pickup progress

Google Maps does not report passenger pickups back to Rollin through these links. The driver marks pickups manually. We do not mark someone picked up just because the car was near their address.

### Connection failures

Passengers check the saved location every 10 seconds while the realtime connection reconnects. The saved route is checked every 15 seconds to recover missed route updates. These are Supabase reads, not ORS requests.

## Setup

1. Save the openrouteservice API key as `ORS_API_KEY` under Supabase Edge Functions > Secrets
2. Run `supabase/migrations/20260918120000_shared_ride_routes.sql` if the shared-route table has not been created
3. Run `supabase/migrations/20260919090000_ride_ratings_and_pickups.sql` in the Supabase SQL Editor
4. Replace the `ride-route` Edge Function with `supabase/functions/ride-route/index.ts` and deploy it
5. Reload Rollin and test with driver and passenger accounts

The key stays in Supabase. It should not be placed in an `EXPO_PUBLIC_` variable or committed. During the original setup the secret was named `OSR_API_KEY` by mistake; it must be `ORS_API_KEY`.

## Relevant Files

| File | Role |
|---|---|
| `app/ride/offer.tsx` | Driver pickup choice when posting a ride |
| `app/ride/[id].tsx` | Pickup requests, approval, starting and completing a ride |
| `app/ride/tracking/[id].tsx` | Route overview and Google Maps handoff |
| `components/rides/pickup-stops.tsx` | Remaining stops, pickup completion, and manual order |
| `services/ride-navigation-service.ts` | Builds and opens Google Maps links |
| `services/ride-routing-service.ts` | Publishes a fresh position and requests a route |
| `supabase/functions/ride-route/index.ts` | Orders pickups, calculates the road route, and saves it |
| `scripts/test-ride-navigation.cjs` | Checks navigation links and pickup ordering |
