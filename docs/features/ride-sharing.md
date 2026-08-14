# **Ride Sharing**

## Purpose 

The ride sharing feature allows Rollin users to offer rides or request seats from other users who are already travelling to the same destination. 

Ride sharing supports two types of rides:
- **Activity-based rides**
- **Regular rides**

**For activity-linked rides, the destination is connected to the activity location**

**For regular rides, the ride offerer can choose both the pickup location and destination**

The feature allows users to:
    - Select available seats
    - Find available rides
    - request a seat
    - cancel a ride request
    - accept or decline passengers request
    - support multiple passengers
    - view ride status
    - start and complete rides
    - view ride history
    - use live tracking after a request is accepted


## Assumptions
- Rollin ride feeature is a peer-to-peer
- Users are not professional drivers. (It does not mean they cannot drive or does not have license. Just not used to driving for money)
- A single ride can contain multiple passengers
- A passenger must request a seat before joining a ride
- The ride offerer decides whether to accept or decline each request
- Available seats decrease when passengers are accepted
- A ride becomes full when no seats remain
- Activity ride sharing is enabled through the activity's 'ride_sharing' field
- seat count is decided by the ride offerer
- Activity-linked rides uses the activity as the destinatinos
- A user cannot request their own ride
- A user cannot request a ride that is full , cancelled, or expired
- A user can only have one active rides for the same activity
- Multiple users can offer rides for the same activity
- Live tracking becomes available only after a passenger is accepted and the ride has started


## Decisions

### Peer-to-peer Ride model
Rollin does not separate users into permanent drivers and passengers. (IN future , we can implement a user to be registered as a driver before being able to offer rides.)
A user may offer a ride for one trip and request a ride for another

### Activity and regular rides
The system supports both activity based and independent rides. 
An activity ride contains:
- activity_id
- pickup location
- activity destination
- departure time
- available seats

A regular ride contains:
- pickup location
- destination
- departure time
- available seats

### Fixed Destination for Activity Rides
For activity rides, the system automatically uses the activity location as the destination. The ride offerer cannot change the destination. This simplifies the ride creation process and ensures that all ride requests for an activity go to the same location

### Multiple Ride Offers Per Activity
An activity can have multiple ride offerers.

For example:

Pickleball Activity

- Offerer A -> 3 seats
- Offerer B -> 2 seats
- Offerer C -> 4 seats

Passengers can choose between the available rides.

### Multiple Passengers Per Ride
A single ride can have multiple passengers.

For example:

Offerer A -> 3 seats

Passenger 1 -> accepted
Passenger 2 -> accepted
Passenger 3 -> accepted

Ride status: full

### One Active Request Per Activity
A user can only have one active ride request per activity. This prevents users from creating duplicate ride requests and ensures that each request is unique and can be tracked separately.

### Ride status
Ride offers use the following statuses:

- Open - Ride offerer can accept or decline requests, passengers can request seats
- Full - Ride is full, no more requests can be accepted
- Cancelled - Ride has been cancelled, no more requests can be accepted
- In-progress - Ride has started, no more requests can be accepted
- Completed - Ride has been completed, no more requests can be accepted

### Ride request states
Ride requests use the following statuses:

- Pending - Ride request has been sent, ride offerer can accept or decline
- Accepted - Ride request has been accepted, passenger can join the ride
- Declined - Ride request has been declined, passenger cannot join the ride
- Cancelled - Ride request has been cancelled, passenger cannot join the ride

## Technical Hurdles
### Preventing Seat Race Conditions
If two passengers attempted to claim the final seat simultaneously, normal client-side updates could allow both requests.

This was solved using the accept_ride_request database RPC so seat validation and seat reduction happen atomically.

### Activity Ride Destination
For activity rides, the destination is fixed to the activity location.

This avoids confusion and ensures that all passengers arrive at the same place.

### Preventing Duplicate Requests
Users could potentially request multiple ride offers for the same activity.

This was solved using a unique constraint on the ride_requests table: (user_id, activity_id)

This prevents a user from having more than one active ride request per activity.

### Ride Location Coordinates
Ride offers include both a pickup location and coordinates.

## Feature Workflow

### Activity Ride Flow
A user first joins an activity. 
    Activity detail
    |
    Join Activity
    |
    Going
    |
    Ride Options
           |           |
    Offer a ride    Request a ride

### Find a ride
When the passenger selects Find a Ride:

    Activity
    |
    Ride options
    |
    find a ride
    |    
    available rides for activity
    |
    select ride
    |
    ride details
    |
    request a seat

The user can review:

- Ride offerer
- Pickup location
- Destination
- Departure time
- Available seats
- Notes

### Offer a Ride

When the user selects Offer a Ride:

    Activity
    |
    Ride Options
    |
    Offer a Ride

The user enters:

- Pickup location
- Departure date
- Departure time
- Available seats
- Notes

The destination is automatically filled from the activity location.

### Regular Ride Flow

A user may also create a ride that is not associated with an activity.

For a regular ride, the user enters:

- Pickup location
- Destination
- Date
- Time
- Available seats
- Notes

### Passenger Requests Seat

When the passenger taps Request Seat:

- ride_requests
- status = pending

The ride offerer can then see the incoming request.

### Ride Request Actions

- Accept: request becomes 'accepted and available seats decrease by 1.
- Decline: request becomes 'rejected'.
- Cancel: passenger request becomes 'cancelled.
- If seats reach 0, the ride status becomes 'full'.

### Ride Lifecycle

- Start Trip -> ride becomes 'in_progress' and live tracking begins.
- Complete Trip -> ride and accepted requests become 'completed'.
- Cancel Ride -> ride becomes 'cancelled.

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
