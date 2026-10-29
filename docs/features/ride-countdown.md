# Ride Departure Countdown

## Purpose

Riders can see at a glance when a ride is leaving soon. Rides leaving within the hour show a "Leaving in X mins" badge that counts down live, and once a ride leaves, it shows "Departed" and can no longer be requested.

## Assumptions

- The badge only appears within 60 minutes of departure. Rides further out show no badge.
- The countdown is based on the device's clock and the ride's departure time.
- Once a ride has departed, new seat requests make no sense, so the request controls are hidden.
- Passengers who already requested a seat can still cancel their request after departure.

## Decisions

### One shared badge component

The countdown lives in `DepartureCountdownBadge`, used by both the ride cards and the ride details page, so they always look and behave the same. It takes only the ride's `dateTime`.

### Updates every 30 seconds

The badge keeps the current time in state and refreshes it every 30 seconds with a timer that is cleared when the screen closes. Minute-level accuracy is enough for "leaving soon," and a 30-second interval keeps the count current without re-rendering every second.

### 60-minute window

The window is a single constant, `WINDOW_MINUTES`, so it's easy to change. An hour is long enough to plan around but short enough that the badge still means "hurry."

### Hiding requests after departure

The ride details page uses the same 30-second clock to work out whether the ride has departed. When it has, it hides **Request a Seat** and the pickup option and shows "This ride has already left."

## Feature Workflow

1. A driver offers a ride with a departure time.
2. Within 60 minutes of departure, the ride's card and details page show a red **Leaving in X mins** badge.
3. The count goes down live while the screen is open.
4. At departure, the badge turns gray and says **Departed**.
5. On the details page, Request a Seat is replaced with "This ride has already left."

## Interface Details

- **Leaving soon:** red pill with an hourglass icon, using the theme's `error` and `errorContainer` colors.
- **Departed:** gray pill with a car icon.
- "1 min" vs "mins" is handled so the label always reads correctly.

## Relevant files

- `components/rides/departure-countdown-badge.tsx`: the countdown badge and its 30-second timer
- `components/rides/available-ride-card.tsx`: shows the badge on ride cards
- `components/rides/ride-detail-card.tsx`: shows the badge on the ride details page
- `app/ride/[id].tsx`: hides seat requests once the ride has departed