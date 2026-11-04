# Road Routing and Passenger Pickups

Rollin plans a ride's pickup stops and shows the route. Drivers use Google Maps for directions and return to Rollin to mark pickups or finish the trip.

## Pickup choices

A driver can use a shared meetup spot or allow separate passenger pickups. A passenger can also request a different address for a shared-meetup ride. The driver sees that address before accepting; accepting approves the pickup location. Changing it afterward requires cancelling and requesting again.

The route starts at the driver's current location, visits the remaining pickups, and ends at the destination. The driver needs location permission, and pickup/destination coordinates must be saved.

## Planning and driving

Openrouteservice (ORS) supplies road distances and routes. For up to ten passengers, Rollin uses those distances to choose the pickup order with the lowest total distance. That is the best order for the distances returned, not a guarantee about every possible road or traffic condition.

Drivers can move a stop earlier in the list. That order stays saved until they recalculate it. Marking someone picked up removes them from the remaining route.

On **Your Drive**, use the navigation control to open Google Maps. Maps calculates its own directions, so they may differ from the overview in Rollin. If Maps is not installed, the link opens in a browser.

The route link includes up to three intermediate stops and the destination. Longer trips open one stop at a time, with an explanation to the driver. **Navigate to next stop** opens just the next pickup or destination.

Google Maps does not tell Rollin when a passenger gets in. While parked, return to Rollin and mark the passenger picked up. After all accepted passengers are picked up and the trip is finished, use **Complete Ride**. Ratings are available afterward.

## What passengers see

Passengers load the driver's saved route from Supabase. Their Refresh button does not request a new route from ORS. Distances are displayed in miles.

Live location sharing pauses when the driver leaves Rollin, including when they open Google Maps. Passengers see the last update time and a message if it is old. Background location sharing is not implemented yet.

## Keeping requests under control

Planning an unordered trip uses one ORS matrix request for distances and one directions request. Refreshing a trip with an order already chosen uses a directions request. Moving the car marker does not recalculate the road route.

While recovering from connection problems, passengers check the saved location every ten seconds and the saved route every fifteen seconds. Those are Supabase reads, not ORS requests.

## Supabase setup

1. Add the openrouteservice key as `ORS_API_KEY` under **Edge Functions → Secrets**.
2. Confirm the shared-route table and its access rules are installed. The original shared-route setup file is not in the current repository; get those definitions from the existing Supabase project when creating a new backend.
3. Apply `supabase/migrations/20260919090000_ride_ratings_and_pickups.sql` for pickup and rating support.
4. Deploy `supabase/functions/ride-route/index.ts` as the `ride-route` function.
5. Test using a driver account and a passenger account.

Keep the key in Supabase, outside the app and Git. An early setup used the misspelled name `OSR_API_KEY`; the function expects `ORS_API_KEY`.

## Main files

- `app/ride/offer.tsx`: pickup choice when offering a ride.
- `app/ride/[id].tsx`: requests, approval, and starting the trip.
- `app/ride/tracking/[id].tsx`: route and pickup page.
- `components/rides/drive/driver-pickup-panel.tsx`: pickup order, progress, and completion.
- `components/rides/drive/passenger-pickup-card.tsx`: each passenger's pickup controls.
- `services/ride-navigation-service.ts`: Google Maps links.
- `services/ride-routing-service.ts`: asks for a route from the current position.
- `supabase/functions/ride-route/index.ts`: calculates and saves the route.

Run `node --test scripts/test-ride-navigation.cjs` when changing navigation links or pickup ordering. Also check the links on a phone with several stops.
