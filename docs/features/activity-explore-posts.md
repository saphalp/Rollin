# Explore Posts on Activities

An activity page has an **Explore posts** section showing photos tagged with that activity. This lets people see what others shared without searching the whole Explore feed.

## Using the section

Each preview shows the first photo, author, date, caption, and number of photos. Tap it to open the full post, swipe through its pictures, like it, or share it.

Six posts load at a time, newest first. **Load more posts** shows the next group. The section refreshes when you return to the page, and **Refresh** lets you check manually. Past activities keep the section so people can look back at photos.

Posts are linked using the activity saved with the upload. Typing an activity's name in a caption does not tag it by itself.

## Who can see a post

The viewer, host, and author need active accounts, and the viewer must pass the current login checks. For someone else's post, both the host's and author's profiles must be visible to the viewer. A private profile requires an accepted follow or ownership; a pending follow is not enough.

Authors can see their own posts without following the host, as long as the other access rules allow it. For a private activity, the viewer must also be the host or an attendee. A pending join request does not count.

These rules are checked by Supabase for posts, image records, and likes. They also apply to new requests from Explore, direct post links, and shared chat previews. Privacy changes take effect when data is requested again; they cannot instantly remove something another phone has already loaded.

Photos currently use public storage URLs. Hiding a post in the database does not stop someone opening a photo URL they already copied. Making those files private would require changing image loading across the app too.

## Supabase setup

Before using the section on a new backend, run the full file:

```text
supabase/migrations/20261029160000_activity_explore_posts.sql
```

It adds `get_activity_explore_posts`, an index for finding posts by activity, and three extra read-access rules. Existing account helpers (`rollin_can_view_profile`, `rollin_account_active`, and `login_email_verified`) must already be installed. The file can be rerun safely and does not delete user data.

The rules affect post requests across the shared project, including older app builds. The new screens show an error until the query function is installed. No new secret, email template, or Edge Function deployment is needed.

## Main files

- `components/activity/activity-posts-section.tsx`: the previews and controls.
- `hooks/use-activity-posts.ts`: loading, extra pages, refresh, and account changes.
- `services/activity-posts-service.ts`: calls the database and prepares image URLs.
- `app/activity/[id].tsx`: places the section on the activity page.
- `app/post/[id].tsx`: opens a full post and rechecks access when returning to it.

The query uses the signed-in user's permissions. It loads the author, photos, and likes together, and supports older posts that only stored one image. A failed load shows Retry rather than falling back to a request without privacy checks.

## Testing

```powershell
node --test scripts/test-activity-posts.cjs scripts/test-activity-posts-db.cjs
```

The database test uses the same local PGlite installation as [messaging tests](messaging-and-notifications.md#testing), not the shared Supabase project.

On a phone, open an activity with posts, try Load more, and open a full post. Check another activity and one with no posts. With two accounts, test private hosts, private authors, pending and accepted follows, and a private activity's host, attendee, and outsider. Test direct post links as well. Finally, try a failed connection, Retry, and switching accounts.
