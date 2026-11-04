# Reviews

Users can review a host after an activity or rate someone they shared a completed ride with. Reviews use one to five stars and an optional comment. A profile shows the combined average, and its reviews page can filter between rides and hosting.

## Write a review

Open another user's profile, tap the reviews stat, and choose **Write a review**. Choose Hosting or Rides, then the activity or trip. Only eligible items that have not already been reviewed appear.

Attendees can also open a past activity's three-dot menu and choose **Review Host**. After submitting, that item changes to **Host Reviewed**. Ride ratings remain available through the ride rating form and reminders.

Reviews cannot be edited once saved. Each person gets one host review per activity and one ride review per participant. Self-reviews are not allowed.

## Who is eligible

For a host review, the user must have RSVP'd and the activity's start time must have passed. Rollin has no check-in system, so this does not prove the person actually attended.

Ride reviews require a completed ride and the correct driver/passenger relationship. See [Ride Ratings](ride-ratings.md). Reports about problems are handled separately through [Reporting](reporting.md).

## Showing reviews

Reviews are named: the page shows the reviewer, stars, comment, and what they reviewed. The profile has one combined average. Choosing Hosting or Rides on the reviews page changes its summary to match that filter.

Host reviews use `host_reviews`, while ride ratings stay in `ride_ratings`. `profile_reviews` and `review_summary` combine them for display.

## Server checks and privacy

`save_host_review` reads the host from the saved activity and checks attendance and time. `save_ride_rating` checks the completed ride. Both reject a second review, including two requests arriving at almost the same time. The app's hidden controls are only a convenience; the database makes the final decision.

The reviews page uses `ProfilePrivacyGate` to hide private profiles in the app. There is an existing limitation: the `profile_reviews` function itself does not check profile privacy. Its broader read permissions mean the screen's privacy check is not full protection against a direct database-function request. Keep that distinction when changing or describing this feature.

## Main files

- `app/reviews/[userId].tsx`: summary, filters, and review list.
- `components/reviews/ReviewFormSheet.tsx`: review selection and form.
- `components/reviews/ReviewCard.tsx`, `ReviewFilter.tsx`, and `StarRating.tsx`: shared review controls.
- `services/reviews-service.ts`: review requests.
- `hooks/use-review-summary.ts`: profile average.
- `supabase/migrations/20261020120000_host_reviews.sql`: host review setup.
- `supabase/migrations/20261021120000_reviews_once.sql`: final-review rules.

`scripts/test-ride-database.cjs` checks the database rules. Also try the activity shortcut, both review filters, an ineligible activity, and a second submission on a phone.
