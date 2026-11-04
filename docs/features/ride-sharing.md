# Ride Sharing

Students can offer spare seats or ask for a ride to the same destination. A user can drive for one trip and be a passenger on another. Offering rides requires the project's driver verification checks.

Rides can be linked to an activity or be independent trips. For an activity ride, Rollin fills in the event destination and date. For an independent ride, the driver chooses both.

## Find a ride

Open **Rides** to browse offers and requests, or open an activity with ride sharing enabled. Its ride section previews up to three upcoming offers with seats available. **View all rides and requests** opens the list for that activity.

Open an offer to check the driver, pickup, destination, departure time, seats, and notes. Request a seat and wait for the driver to accept it. A pending request is not a reserved seat.

If no offer works, use **Request a Ride** to post where and when you need one. Requests started from an activity stay linked to it. The form waits for the activity details to load and offers Retry if that fails.

## Offer a ride

Drivers choose a pickup location, departure time, seats, and any notes. They can use one meetup spot or allow individual passenger pickups.

For an activity ride, the event's start time appears above the form. The date comes from the activity and cannot be changed, but the driver chooses the departure time. The destination is the activity location. If the host has not saved a date, they need to fix the activity before a ride can be offered.

Independent rides have editable pickup, destination, date, and time. Departures must be in the future. Multiple drivers can offer rides for the same activity.

## Seats and requests

The driver sees incoming requests and can accept or decline them. Accepting uses a seat; when none remain, the ride is full. The server handles the seat check and update together so two requests cannot take the last seat at the same time.

Passengers cannot request their own ride or a ride that is full, closed, or past departure. Duplicate active requests for the same activity are blocked. A passenger can withdraw a pending request or cancel an accepted seat when the ride's state permits it. The driver receives an update when the passenger does this themselves; requests cancelled as part of cancelling the whole ride or activity do not send that extra update.

## Answer a posted ride request

Open **Requests → Requested by others** to find people looking for a ride. Tapping a request opens an offer form with that passenger's pickup, destination, and time already set. The driver chooses the number of seats, including that passenger's, and adds notes.

Saving creates the ride, gives the requester an accepted seat, and marks the request fulfilled together. A request can only be answered once, by someone other than its requester, and only by a verified driver.

Earlier, this action created a ride without adding the passenger to it. Doing all three steps in the `offer_ride_for_wanted_request` database function keeps them connected. From there, pickups, tracking, completion, and ratings work like any other ride.

## Take the trip

1. The driver accepts the passenger requests and reviews pickup locations.
2. **Start Drive** starts the trip and location sharing after permission is granted.
3. On **Your Drive**, the driver can navigate to the next stop, change pickup order, and mark each passenger picked up.
4. **Complete Ride** becomes available after all accepted passengers are marked picked up.
5. Completing the trip updates the ride and its passengers, ends tracking, and opens ratings.

An in-progress ride has **Continue Drive** on its details page. Google Maps handles turn-by-turn directions; Rollin handles the trip and pickup list. See [Road Routing](road-routing-setup.md), [Live Tracking](live-ride-tracking.md), and [Ride Ratings](ride-ratings.md).

## The Rides tabs

| Section | What it shows |
|---|---|
| Offering → Offered by you | Your open, full, or in-progress rides |
| Offering → Offered by others | Upcoming offers from other students with seats available |
| Requests → Requested by you | Your pending/accepted seats and open ride requests |
| Requests → Requested by others | Seat requests on your rides and other students looking for a ride |
| History | Completed, cancelled, and expired rides and older requests |

Cards show the activity name or **Independent ride**. Open cards to manage the request or see the trip details.

An open or full ride expires if it has not started within 30 minutes after departure. This gives a late driver a short chance to start it. A trip already in progress does not expire this way. Closed rides are read-only, though completed rides keep **Rate this ride**.

## Database notes

Offers are stored in `rides_offered`, seats in `ride_requests`, and posts looking for a ride in `ride_wanted_requests`. Ride states include open, full, cancelled, in progress, and completed. Requests move through pending, accepted, rejected, cancelled, and completed as appropriate.

Relevant setup files in `supabase/migrations/` include:

- `202610130001_require_activity_date.sql`: required dates on new activities and date changes.
- `20261102120000_ride_seats_and_cancelled_activity_rides.sql`: seat handling and rides affected by activity cancellation.
- `20261103120000_offer_ride_for_wanted_request.sql`: answering a passenger's posted request.
- `20261103120000_prevent_duplicate_ride_requests.sql`: duplicate request checks.
- `20261105120000_notify_driver_on_seat_cancel.sql`: driver notifications when a passenger cancels.

Check which files are already applied before updating the shared database. Older undated activities keep their data until the host sets a date.

## Main files

- `app/(tabs)/rides.tsx`: offers, requests, and history.
- `app/ride/offer.tsx`, `app/ride/request.tsx`, and `app/ride/available.tsx`: create and browse trips.
- `app/ride/[id].tsx`: ride details and seat decisions.
- `components/activity/activity-rides-section.tsx`: rides on an activity page.
- `components/rides/offer/requested-ride-offer-form.tsx`: answer a posted request.
- `components/rides/drive/driver-pickup-panel.tsx`: pickup progress and completion.
- `services/ride-requests-service.ts`, `services/offerer-ride-requests-service.ts`, and `services/ride-lifecycle-service.ts`: request and trip actions.
- `lib/ride-status.ts`: whether a ride is still active or belongs in History.

## Testing

Use a driver and passenger account. Offer a ride for activity A and check that it does not appear under activity B. Request and accept a seat, cancel one, and check the available seat count. Try posting a wanted ride both with and without existing offers, then have a driver answer it and confirm the passenger is actually on the new ride.

Check the fixed activity date, editable departure time, empty/error states, duplicate requests, full rides, pickups, completion, and History. The matching `test-activity-rides`, `test-duplicate-ride-requests`, `test-wanted-ride-offer-db`, and ride-dashboard tests are in `scripts/`.
