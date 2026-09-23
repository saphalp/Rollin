# Road Routing and Driver Directions

## Purpose

This feature allows the ride offerer to see a road route from their location to the pickup and destination. Accepted passengers can see the same route along with the driver's current location.

## Assumptions

- The ride has saved coordinates for its pickup and destination
- The driver grants location permission and keeps the app open while driving
- The passenger's ride request has been accepted
- The Supabase project has the routing function and ORS API key configured
- The ride currently uses one shared pickup location

## Decisions

### openrouteservice

We chose openrouteservice (ORS) for road routing. The app already displays a map, but displaying the map does not calculate a driving route. ORS provides the road coordinates, distance, estimated travel time, and written directions.

The request uses the shortest route option. It follows the stop order we provide: driver, pickup, then destination. Choosing the best order for multiple passenger pickups still needs to be added.

### Shared route

The driver calculates the route, which is saved in the Supabase `ride_routes` table. Passengers read this saved route so everyone sees the same plan. Refreshing the passenger's screen does not make another ORS request.

### Separate driver and passenger controls

The driver has a Start Drive button on Ride Details. This starts location sharing and opens the full-screen map. Passengers have Open Live Tracking instead.

The Directions button displays the written steps returned by ORS. The app does not yet advance through these steps as the driver moves or read them aloud.

### Miles

Distances are displayed in miles. Route data is still stored in meters and converted when displayed.

## Technical Hurdles

### API key setup

The key is stored as a Supabase Edge Function secret named `ORS_API_KEY`. During setup, it was accidentally named `OSR_API_KEY`, so the function could not find it. Correcting the name fixed the configuration error.

The app calls the `ride-route` function rather than calling ORS directly. This keeps the key out of the mobile app. The function checks that the user is the driver or an accepted passenger before returning a route.

### Route updates

GPS updates move the car marker without making another ORS request. Start Drive and the driver's route refresh button request a new route. Automatic rerouting after a missed turn has not been added.

Pickup completion also needs to be added. For now, refreshing the route still includes the pickup even if the driver has already passed it.

### Distance and ETA

The route summary uses the road distance and travel time returned by ORS. It does not account for live traffic. The passenger's proximity card still estimates distance and ETA from the driver's position directly to the passenger or pickup, so its values can differ from the route total.

## Feature Workflow

### Driver

1. The ride offerer opens Ride Details and presses Start Drive
2. The ride becomes in progress if it has not started yet
3. The app requests location permission and shares the driver's current position
4. The routing function calculates and saves the route
5. The full-screen map opens with the route and car marker
6. The driver can press Directions to view the steps
7. The back arrow closes the full-screen map without completing the trip or stopping sharing
8. The driver can stop sharing from Your Drive or complete the trip from Ride Details

### Passenger

1. The passenger requests a seat and the driver accepts
2. Once the ride starts, the passenger presses Open Live Tracking
3. The app loads the driver's saved route
4. The car marker moves as location updates arrive

If the live connection drops, the app checks the saved driver location every 10 seconds while reconnecting. The saved route is also checked every 15 seconds in case a route update was missed.

## Setup

1. Create an account at [HeiGIT](https://account.heigit.org/) and get an openrouteservice API key
2. In the Rollin Supabase project, open **Edge Functions > Secrets** and save the key as `ORS_API_KEY`
3. Run `supabase/migrations/20260918120000_shared_ride_routes.sql` in the Supabase SQL Editor
4. Create or update the `ride-route` Edge Function using `supabase/functions/ride-route/index.ts`
5. Keep JWT verification enabled and deploy the function
6. Run `npm ci` and `npx expo start --clear` to open the app
7. Start a drive and check the route using a driver account and an accepted passenger account

The key belongs in Supabase secrets, not in an `EXPO_PUBLIC_` variable or a committed file. If the app says routing is not configured, check the secret name and that it is saved in the same Supabase project the app uses.

## Interface Details

Driver:

- Start Drive button on Ride Details
- Full-screen map with the road route and car marker
- Directions button to show or hide the steps
- Route refresh and location-sharing controls on Your Drive

Passenger:

- Open Live Tracking button on Ride Details
- Driver's saved route and current location
- Distance, approximate ETA, and connection status

The web version currently shows coordinates and the route summary instead of the native map.

## Relevant Files

| File | Role |
|---|---|
| `app/ride/[id].tsx` | Shows driver and passenger actions on Ride Details |
| `app/ride/tracking/[id].tsx` | Opens the driver map or passenger tracking screen |
| `components/rides/driver-drive-view.tsx` | Full-screen driver map and directions |
| `components/rides/road-route-summary.tsx` | Loads, refreshes, and displays the saved route |
| `components/rides/live-ride-map.native.tsx` | Draws the route and location markers |
| `services/ride-routing-service.ts` | Calls the routing function and formats distances |
| `supabase/functions/ride-route/index.ts` | Requests directions from ORS and saves the route |
| `supabase/migrations/20260918120000_shared_ride_routes.sql` | Creates the shared-route table and access policies |
| `scripts/test-ride-route.cjs` | Tests the function using sample Supabase and ORS responses |
