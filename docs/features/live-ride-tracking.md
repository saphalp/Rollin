# Live Ride Tracking

Accepted passengers can see the driver's location after a ride starts. The tracking page also shows pickup and destination locations, distance, an approximate arrival time, and whether the last update is getting old.

## How it works

1. A passenger requests a seat and the driver accepts it.
2. The driver taps **Start Drive** and grants location permission.
3. While Rollin is open, the driver's phone sends location updates to Supabase.
4. Accepted passengers receive those updates on the tracking map.
5. Completing or cancelling the ride ends location sharing.

The driver can also stop sharing from **Your Drive**. Passengers can view the trip but cannot publish the driver's location.

Rollin saves the latest location for each ride rather than a full GPS history. The database checks that the person publishing is the driver and that viewers are allowed participants.

## Current limits

Location sharing runs while Rollin is open. It pauses when the driver switches to another app, including Google Maps, and resumes when they return. Passengers see the last update time so an old position is not mistaken for a new one. Having a Play Store build does not add background tracking by itself.

GPS accuracy depends on the phone and surroundings. Markers can appear slightly off the road or jump between updates. The map does not currently smooth the movement or snap it to the road. Arrival times are estimates, not traffic-aware promises.

Without location permission, the driver cannot publish a live position. A connection failure can also delay updates. The page needs to explain those states rather than leaving passengers guessing.

For planned stops and Google Maps directions, see [Road Routing and Passenger Pickups](road-routing-setup.md).

## Main files

| File | What it does |
|---|---|
| `app/ride/tracking/[id].tsx` | Driver and passenger tracking page |
| `components/rides/live-ride-map.native.tsx` | Android/native map and markers |
| `components/rides/live-ride-map.web.tsx` | Web fallback |
| `components/rides/live-ride-status.tsx` | Distance, estimated arrival, and old-location message |
| `hooks/use-live-ride-location.ts` | Sends and receives location updates |
| `services/ride-tracking-service.ts` | Location permission, storage, and calculations |
| `services/ride-notifications-service.ts` | Arrival notifications |

The original location-table setup is not included in the current migration folder. When recreating the backend, get the `ride_locations` table definition, access rules, and Realtime settings from the existing Supabase project.

Test with an accepted passenger and an unrelated account. Only allowed participants should see tracking. Also test denied location permission, a lost connection, switching out of Rollin, returning to it, and completing the trip.
