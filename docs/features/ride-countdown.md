# Ride Departure Countdown

A ride leaving within the next hour shows **Leaving in X mins** on its card and detail page. The red badge pulses while departure is approaching. At the scheduled departure time, it turns gray and says **Departed**.

## How the time is checked

The badge compares the ride's departure time with the phone's clock and updates every 30 seconds. Rides more than 60 minutes away have no countdown badge. Invalid or missing times do not show one either.

“Departed” means the scheduled departure time has passed. It is not a GPS check or proof that the driver has started the ride. The [ride status rules](ride-sharing.md#the-rides-tabs) separately allow a short grace period for the driver to start.

Once departure has passed, new seat-request controls are hidden. Existing passengers can cancel only while the ride's state still allows it.

## Why it is shared

Cards and ride details use the same `DepartureCountdownBadge` component, so the labels and timing stay consistent. Thirty-second updates are enough for a minute-based countdown without updating the whole display every second. The component clears its timer and animation when it closes.

## Main files

- `components/rides/departure-countdown-badge.tsx`: countdown text, colors, and animation.
- `components/rides/available-ride-card.tsx`: badge on offer cards.
- `components/rides/ride-detail-card.tsx`: badge on the detail page.
- `app/ride/[id].tsx`: whether a seat can still be requested.

Check a ride more than an hour away, one within the hour, and one just past departure. Leave the page open as the time changes and make sure the card and details agree.
