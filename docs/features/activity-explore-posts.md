# Explore posts on activities

The activity detail screen includes an **Explore posts** section below ride sharing
(or below the activity information when rides are unavailable). It shows posts whose
`activity_photos.activity_id` matches that activity. Typing an activity title into a
caption alone does not tag it; existing photo uploads already save the activity ID.

Previews show the first photo, author, date, caption and photo count. Tap one to open
the existing full post screen with its carousel, likes, sharing and reporting.
Six posts load at a time, newest first, with **Load more posts** for the next page.
The section includes empty, loading, retry and refresh states. It also appears on
past activities so users can look back at photos.

## Privacy rules

The database restricts reads of posts, image records and likes, in addition to all
existing RLS policies:

- The viewer must have completed email login verification and have an active account.
- The activity, host and author must still be accessible/active.
- For another person's post, both the host's and author's profiles must be visible
  under the existing profile privacy helper. Public profiles are visible; private
  profiles require an accepted follow or ownership. Pending follows do not qualify.
- Authors can see their own posts without following the host, provided the other
  activity and account rules permit access.
- For a private activity, the viewer must also be the host or have an RSVP. A pending
  join request is insufficient. Merely following the host does not grant attendance.
- Existing restrictions are preserved. These new policies are restrictive SELECT
  policies; they do not add permission to create, edit or delete posts.

The same restrictions apply to new queries from Explore, direct post links and chat
post previews. The activity section and full post screen recheck on focus, returning
from the background and local account-setting changes. Refresh clears old results
before checking again; errors never fall back to an unrestricted query. Remote
privacy changes take effect on the next query/refresh, not by instantly retracting
content already rendered on another device.

**Existing storage limitation:** `activity-photos` uses public image URLs throughout
the app. Database RLS hides post metadata and image-path records but does not revoke
an image URL that somebody already copied or cached. Strict media confidentiality
would require a separate coordinated change to a private bucket and authorized image
delivery across Explore, posts, profiles and chat previews. This feature does not
claim to provide that protection or change the bucket configuration.

## Supabase setup

Run the complete contents of
`supabase/migrations/20261029160000_activity_explore_posts.sql` in the shared project's
SQL Editor before testing the new screens. It is safe to rerun. This adds a query
function and index, and adds/replaces only the three policies named in that file.
It creates no tables and deletes no user data. Existing account-privacy functions
(`rollin_can_view_profile`, `rollin_account_active`) and `login_email_verified` must
already exist. The transaction fails rather than silently bypassing missing setup.

This SQL affects other team members' new post queries too: private posts previously
returned by permissive policies may disappear for viewers without access. Deploy
the SQL before distributing the updated app; the new activity and post screens
show an error until the RPC is installed. No Edge Function deployment, API key or
email-template change is needed. Codex has not applied this to the shared project.

## Implementation

- `services/activity-posts-service.ts`: RPC loading, exact timestamp/ID cursors and media mapping.
- `hooks/use-activity-posts.ts`: focus lifecycle, paging, cancellation, errors and account isolation.
- `components/activity/activity-posts-section.tsx`: accessible previews and controls.
- `app/activity/[id].tsx`: section placement.
- `app/post/[id].tsx`: permission-aware loading and unavailable/retry states.
- `get_activity_explore_posts`: security-invoker query using the caller's RLS. It
  returns ordered image paths (with a legacy single-image fallback), author and
  likes in one database snapshot. No service-role key is used in the app.

## Testing

Automated checks:

```sh
node --test scripts/test-activity-posts.cjs scripts/test-activity-posts-db.cjs
```

The database test uses isolated PGlite under
`.expo/login-security-validation/node_modules/@electric-sql/pglite`, like the existing
messaging SQL tests. It never connects to Supabase. Tests cover privacy combinations,
pending/revoked follows, private activity membership, unverified/inactive accounts,
raw table/direct-post access, ordered and legacy images, pagination with identical
timestamps, canceled requests, account switching and errors. The fixture models
existing permissive policies; the shared database still needs the manual checks below.

Phone checks after applying the SQL:

1. Open an activity with tagged photo posts. Check previews and open a full post.
   Swipe multiple photos, like it, return, and verify the section reloads.
2. Open another activity and one with no posts; posts must not cross activities.
3. With more than six visible posts, load the rest and check ordering/duplicates.
4. Use a second account to test private host and private author independently.
   Refresh: a non-follower/pending follower should not see those posts; an accepted
   follower should. Remove the follow and check again. Test the saved direct post link too.
5. For a private activity, compare an approved attendee, the host and an outsider.
6. Disconnect the network, refresh, then reconnect and retry. Old posts should clear
   and an error should appear; retry should recover. Switch accounts and verify no
   posts from the previous account briefly remain.
