# Live Ride Tracking
## Purpose
The live ride tracking feature allows accepted passengers to see the driver's live location after the ride has started. It also allows the driver to see the passenger's location.

The features provides:
- Live ride offerer location
- Passenger/pickup location
- Distance between users
- Estimated time of arrival
- Arrival detection
- Realtime location updates through supabase

## Assumptions
- Rollin has a peer-t0-peer ride-sharing feature 
- Any user can offer a ride 
- A single ride can have multiple passengers
- Only accepted passengers can view live location
- The rider offerer controls when location sharing starts and stops
- The device must grant location permissions for location tracking
- Supabase realtime is used for location updates
- Tracking stops when the ride is comlpleted or cancelled
- GPS accuracy depends on the user's device and location
- The current feature does not include smooth animated movement of the tracker, markers, or road snapping (like uber), but these features could be added in the future.

## Decisions
### Tracking only starts after Acceptance

Passenfer requests a ride
|
Ride offerer accepts
|
Request = accepted
|
Ride offerer starts trip
|
Ride = in progress
|
Live tracking begins

### Ride Offerer controls Location sharing
- Location sharing does not happen automatically. the driver has an option to share or not share the location manually. 

### Supabase Realtime
- The ride offere publishes location updates to supabase

Accepted passengers subscribe to those changes using supabase realtime

###Latest location storage
- The system stores the latest location for each ride instead of keeping a complete GPS history


## Technical Hurdles
###Location Permissions
-The ride offerer must grant device location permissions before tracking can begin. If it is denied, the live tracking feature cannot publish GPS coordinated. 

Realtime synchronization
- Passengers need location updates without refreshing the application

### RLS 
- The ride_locations table requires RLS policies.
The policies must:
    - Allow the ride offerer to insert location data
    - Allow accepted passengers to select the latest location 
    - Protect against unauthorized access

### GPS accuracy
-Raw gps coordinated may occasionally appear slightly away from the road

### Marker movement
-Location updates occur periodicall
Because of this, the ride marker may move from one coordinate to another instead of using continuous uber-style animation



## Feature Workflow
1. Passenger requests a ride
    A passenger selects a ride and created a ride request
2. Ride offerer accepts passenger
    - The offerer accepts the passenger request.(accepted/denied)
    if all seats are taken:
        - the ride is automatically marked as closed 
3. Tracking Access Becomes Available
    The accepted passenger is eligible to view the live tracking. 
4. Ridee offerer starts trip
    The ride offerer starts a trip and ride status chages to in progress
5. Location is Publised
    The device provides location informations such as
    - latitude
    - longitude
    - heading
    - speed
    - updates_at
4. Passengers receivers updates
5. Distance is calculated
6. ETA is calculated
7. Arrival detection
8. Ride complettion
    When the rider completed the ride, the live location becomes inactive and the ride appears in ride-history


## Interface Details
Ride offerer
- The ride offerer can perform actions such as: 
    - Start trip
    - open live tracking
    - complete trip
    - cancel ride
Passenger
- the passenegr can only view live tracking
    - can see ride offerer location
    -pickup/passenger location
    - distance
    - ETA
    - Ride status
    - Arrival status

Map
- The map updates when new coordinated arrive through supabase.
The current implementation focuses on raw functional live tracking.

Future improvvements:
- smooth animations 
- vehicle, road animations
- Automatic camera following
- Route snapping
- Traffic-aware routes, ETA, distance

## Relevant Files
services/ride-tracking-service.ts
services/ride-lifecycle-service.ts
app/ride/[id].tsx
rides_offered
ride_requests
ride_locations