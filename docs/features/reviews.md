# Reviews

## Purpose

Users can review each other after doing something together. A review is 1 to 5 stars with an optional comment. There are two kinds:

- **Ride reviews**: drivers and passengers rate each other after a completed ride. These are the rows described in [Ride Ratings](ride-ratings.md).
- **Host reviews**: attendees review the host of an activity they went to.

Each profile shows one combined average in its stats bar. Tapping it opens a reviews page that lists every review the user has received, with a filter for rides and hosting.

## Assumptions

- "Attended" means the user RSVP'd and the activity's start time has passed. Rollin has no check-in, so this can't confirm that someone actually showed up.
- A user can't review themselves, and a host can't review their own activity.
- Each person writes one review per activity and one per ride participant. Reviews are final: they can't be edited, and a second review is rejected.
- Reports are a separate feature; see [Reporting](reporting.md).

## Decisions

### Reviews are public and named

Anyone who can see a profile can read its reviews: the stars, the comment, what the review was for, and the reviewer's name and photo. This applies to ride ratings too, which used to be visible only to the author and the recipient. Named reviews are harder to abuse and help students decide which hosts and drivers to trust. The review form tells the author that their review is public.

### One combined average

The profile stats bar shows a single `reviews` value that averages ride and host reviews together. On the reviews page, the summary card follows the selected filter, so choosing Hosting shows the host-only average.

### Separate tables, one read path

Host reviews have their own `host_reviews` table, and ride ratings stay in `ride_ratings`. The ride rating screens and reminders didn't need any changes. The app reads both tables through the `profile_reviews` and `review_summary` functions, which combine them.

### Where you can write a review

- From the reviews page of another user, using **Write a review**. The "Reviewing for" dropdown has two levels: first **Hosting** or **Rides**, then the activity or ride. Only items you haven't reviewed yet are listed.
- From a past activity you RSVP'd to, using **Review Host** in the `…` menu. The form opens on that activity. After you post, the item changes to a disabled **Host Reviewed**.
- Ride reviews can still be written from the ride rating screen and its reminders.

## Technical Hurdles

### Enforcing eligibility on the server

`host_reviews` has row-level security that only lets the author and the host read rows directly, and there's no insert or update permission for clients. All writes go through `save_host_review`. It reads the host from the activity, not from the client, and rejects the review unless the caller RSVP'd, isn't the host, and the activity has started. Both `save_host_review` and `save_ride_rating` insert with `on conflict do nothing` and raise "You already reviewed…" when a row already exists, so a second review is rejected even if two requests race. Ride reviews go through the existing `save_ride_rating`. The app hides the menu item and form when you can't review, but the server checks again either way.

### Profile privacy

`profile_reviews` runs as `security definer` so reviews can be public. The reviews page is wrapped in `ProfilePrivacyGate`, the same as the profile, so private profiles stay hidden in the app. The function itself doesn't check profile privacy, because the privacy function `rollin_profile_access` isn't part of these migrations.

## Feature Workflow

1. A user attends an activity, or completes a ride.
2. They open the host's or driver's profile, tap the reviews stat, and then tap Write a review. For an activity, they can also use Review Host from the activity's `…` menu.
3. They choose what they're reviewing, pick stars, optionally write a comment, and post.
4. The review appears on the recipient's reviews page, and the profile average updates the next time the profile is shown.


## Relevant Files

| File | Role |
|---|---|
| `app/reviews/[userId].tsx` | Reviews page with summary, filter, list, and Write a review |
| `components/reviews/ReviewFormSheet.tsx` | Bottom sheet for choosing an item, stars, and a comment |
| `components/reviews/ReviewCard.tsx` | One review in the list |
| `components/reviews/ReviewFilter.tsx` | All / Rides / Hosting filter |
| `components/reviews/StarRating.tsx` | Star display and star input |
| `hooks/use-review-summary.ts` | Combined average for the profile stats bar |
| `services/reviews-service.ts` | Calls the review functions |
| `app/activity/[id].tsx` | Review Host menu item for attendees of past activities |
| `supabase/migrations/20261020120000_host_reviews.sql` | Host reviews table and review functions |
| `supabase/migrations/20261021120000_reviews_once.sql` | Makes reviews final and limits `review_targets` to unreviewed items |
| `scripts/test-ride-database.cjs` | Tests ride and host review rules in a temporary PostgreSQL database |
