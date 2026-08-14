# **Ride Sharing**

<u>## Purpose</u> 

The ride sharing feature allows Rollin users to offer rides or request seats from other users who are already travelling to the same destination. 

Ride sharing supports two types of rides:
-Activity-based rides
-Regular rides

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

- Offerer A → 3 seats
- Offerer B → 2 seats
- Offerer C → 4 seats

Passengers can choose between the available rides.

### Multiple Passengers Per Ride
A single ride can have multiple passengers.

For example:

Offerer A → 3 seats

Passenger 1 → accepted
Passenger 2 → accepted
Passenger 3 → accepted

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
       |               |
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

### Activity Detail

Joined users see:

```text
Going | Ride Options

Hosts see:
- Edit | Ride Options

Ride Options opens:
- Find a Ride
- Offer a Ride

### Offer Ride

The form includes:

- Pickup Location
- Destination
- Date
- Time
- Available Seats
- Notes

For activity rides, the destination is automatically set to the activity location and locked.

For regular rides, the destination is editable.

### Available Rides

Shows available activity-linked or regular rides.

Activity rides are filtered using activity_id.

### Ride Detail

Passenger actions:

- Request/cancel seat
- View request status
- Open live tracking after acceptance

Ride offerer actions:

- View requests
- Accept/decline passengers
View accepted passengers
Start, complete, or cancel ride
Open live tracking
Rides Dashboard

The dashboard includes:

- Discover
- Offering
- Requests
- History

Relevant Files
app/ride/offer.tsx

Creates ride offers and loads linked activity data.

components/rides/offer/offer-ride-form.tsx

Contains the ride offer form and activity destination locking.

components/activity/ride-options-sheet.tsx

Provides Find a Ride and Offer a Ride options.

app/activity/[id].tsx

Handles activity joining and activity ride options.

app/ride/available.tsx

Displays available rides.

app/ride/[id].tsx

Handles ride details, requests, lifecycle actions, and live tracking.

services/rides-service.ts

Fetches and filters ride offers.

services/ride-requests-service.ts

Creates and cancels passenger ride requests.

services/offerer-ride-requests-service.ts

Handles incoming requests and accept/decline actions.

services/ride-dashboard-service.ts

Loads offered rides, requests, and history.

services/ride-lifecycle-service.ts

Starts, completes, and cancels rides.

services/ride-tracking-service.ts

Handles live ride location tracking.

rides_offered

Stores ride offers, locations, seats, and ride status.

ride_requests

Stores passenger requests and request status.

accept_ride_request

Supabase RPC used to safely accept passengers and reduce available seats.
