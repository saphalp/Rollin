# Ride Ratings

## Purpose

Drivers and passengers can rate each other after a completed ride. Ride ratings are one kind of review; see [Reviews](reviews.md) for host reviews, the reviews page, and the combined profile average.

## Assumptions

- Ratings are for completed rides only
- A driver can rate each passenger separately
- Passengers rate the driver, not other passengers
- A user cannot rate themselves or a ride they did not take

## Decisions

### Stars and comments

Ratings use 1 to 5 stars with an optional comment of up to 1,000 characters. The profile stats bar shows one average across ride ratings and host reviews.

Ratings and comments are public, with the author's name, on the recipient's reviews page. Direct table reads are still limited to the author and recipient; everyone else reads them through the `profile_reviews` function described in [Reviews](reviews.md).

### One final rating

There is one rating per author, recipient, and ride, and it can't be changed once saved. A second save is rejected by `save_ride_rating`. Ride History provides access to the rating form later for anyone not rated yet; saved ratings show as read-only.

### In-app reminders

Completing a ride takes the driver to the rating form. Other participants get a reminder for unrated completed rides while using the app or when they return. Each ride is prompted once per account on the device. The app saves that record across restarts and refreshes. Not now closes the prompt; ratings remain available in History. Clearing app storage or using a different device can show the reminder again. Push notifications are not required for this version.

## Technical Hurdles

### Privacy and eligibility

The ride_ratings table has row-level security. Only the author and recipient can read rows directly. Writes go through save_ride_rating, which checks the completed ride and participant relationship. Public reads go through `profile_reviews` and `review_summary`.

### Completing a ride

The finish_ride function completes the ride and accepted requests, rejects pending requests, and ends location sharing in one database transaction. This avoids a ride being marked completed while some of its passenger records are left unfinished.

## Feature Workflow

1. The driver presses Complete Trip
2. Rollin opens the rating form with one entry per passenger
3. Each passenger gets an in-app reminder to rate the driver
4. The user selects stars, optionally writes a comment, and saves
5. The recipient's profile average reflects the saved rating
6. Either person can open the ride from History and choose Rate this ride to rate anyone they haven't rated yet
7. Anyone can read the rating on the recipient's reviews page

## Setup

Run `supabase/migrations/20260919090000_ride_ratings_and_pickups.sql` in Supabase before using the new screens. The migration adds ratings and the pickup fields used by road routing. `20261021120000_reviews_once.sql` later makes ratings final.

## Relevant Files

| File | Role |
|---|---|
| `app/ride/ratings/[id].tsx` | Rating forms for a completed ride |
| `components/rides/rating-reminder.tsx` | In-app completion reminders |
| `app/reviews/[userId].tsx` | Reviews page that lists ride ratings with host reviews |
| `services/ride-ratings-service.ts` | Loads targets and saves ratings |
| `services/ride-dashboard-service.ts` | Links History entries to the original ride |
| `scripts/test-ride-database.cjs` | Tests the migration in a temporary PostgreSQL database |
