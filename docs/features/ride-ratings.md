# Ride Ratings

## Purpose

Drivers and passengers can rate each other after a completed ride. The profile rating shows the average of the ratings that user has received.

## Assumptions

- Ratings are for completed rides only
- A driver can rate each passenger separately
- Passengers rate the driver, not other passengers
- A user cannot rate themselves or a ride they did not take

## Decisions

### Stars and comments

Ratings use 1 to 5 stars with an optional comment of up to 1,000 characters. The profile shows the average and number of ratings. Users with no ratings see No ratings yet.

Comments are visible only to their author and recipient. The author needs access so they can edit their own comment. Other users can see the average but cannot read individual ratings through the database.

### Editing ratings

There is one rating per author, recipient, and ride. Saving again updates that rating instead of adding another vote to the average. Ride History provides access to the rating form later.

### In-app reminders

Completing a ride takes the driver to the rating form. Other participants get a reminder for unrated completed rides while using the app or when they return. Later dismisses the reminder for the current app session; the ride remains available in History. Push notifications are not required for this version.

## Technical Hurdles

### Privacy and eligibility

The ride_ratings table has row-level security. Only the author and recipient can read a rating. Writes go through save_ride_rating, which checks the completed ride and participant relationship. The public summary function returns only the average and count.

### Completing a ride

The finish_ride function completes the ride and accepted requests, rejects pending requests, and ends location sharing in one database transaction. This avoids a ride being marked completed while some of its passenger records are left unfinished.

## Feature Workflow

1. The driver presses Complete Trip
2. Rollin opens the rating form with one entry per passenger
3. Each passenger gets an in-app reminder to rate the driver
4. The user selects stars, optionally writes a comment, and saves
5. The recipient's profile average reflects the saved rating
6. Either person can open the ride from History and choose Add or edit ride ratings
7. Recipients can read their private feedback on their own profile

## Setup

Run `supabase/migrations/20260919090000_ride_ratings_and_pickups.sql` in Supabase before using the new screens. The migration adds ratings and the pickup fields used by road routing.

## Relevant Files

| File | Role |
|---|---|
| `app/ride/ratings/[id].tsx` | Rating forms for a completed ride |
| `components/rides/rating-reminder.tsx` | In-app completion reminders |
| `components/profile/RideRatingSummary.tsx` | Profile average, count, and private feedback |
| `services/ride-ratings-service.ts` | Loads targets and saves ratings |
| `services/ride-dashboard-service.ts` | Links History entries to the original ride |
| `scripts/test-ride-database.cjs` | Tests the migration in a temporary PostgreSQL database |
