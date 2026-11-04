# Ride Ratings

Drivers and passengers can rate each other after completing a ride. The driver can rate each passenger separately; passengers rate the driver. Users cannot rate themselves or a trip they did not take.

## Leave a rating

Completing a ride opens the driver's rating form. Other participants get an in-app reminder for completed rides they have not rated. Choose one to five stars, add an optional comment of up to 1,000 characters, and save.

**Not now** closes the reminder. The rating form is still available through **History → Rate this ride**. A reminder is shown once per ride and account on that device, even after restarting the app. Clearing storage or using another device can show it again.

Ratings are final once saved. The server allows one rating per author, recipient, and ride; a second save is rejected. Saved ratings appear read-only.

## Where ratings appear

The recipient's profile shows an average that combines ride ratings and host reviews. Open their [reviews page](reviews.md) to see the stars, comment, and reviewer's name. The form tells people their review is public.

Direct reads of `ride_ratings` are limited to the author and recipient. Other readers use the review functions described on the Reviews page, including the privacy limitation documented there.

## Development notes

`save_ride_rating` checks that the ride is completed and that the users were participants. Eligibility must be checked on the server even when the form is hidden in the app.

`finish_ride` completes the trip and its accepted requests, rejects pending requests, and ends location sharing together. That prevents the ride and its passenger records from disagreeing about whether it finished.

Apply `supabase/migrations/20260919090000_ride_ratings_and_pickups.sql` when setting up this feature. `20261021120000_reviews_once.sql` adds the rule that saved ratings cannot be changed.

## Main files

- `app/ride/ratings/[id].tsx`: rating forms.
- `components/rides/rating-reminder.tsx`: in-app reminders.
- `services/ride-ratings-service.ts`: loads eligible people and saves ratings.
- `app/reviews/[userId].tsx`: shows received reviews.
- `scripts/test-ride-database.cjs`: checks ride and review rules in a temporary database.

Test a completed ride with more than one passenger, saving twice, choosing Not now, returning through History, and signing into another account on the same device.
