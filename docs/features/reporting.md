# Reporting

## Purpose

Users can report another user, an activity, or a photo post from the Explore feed. Reports are reviewed in the separate Rollin Analytics app, not inside Rollin.

## Assumptions

- Reporting is reached only from a three-dot submenu, never from a button on the profile, post, or activity itself.
- You can't report yourself, your own activity, or your own post, so the Report item is hidden there.
- A reason is required. Extra details are optional, up to 1000 characters.
- The reported person isn't told who reported them.

## Decisions

### Flow

The submenu opens the `/report` screen with `type` (`user`, `activity`, or `post`), `id`, and an optional `name` for display. The screen has three steps: choose a reason and add optional details, confirm the summary, then a message that the report has been submitted and will be reviewed. The reason list depends on the target type (`REPORT_REASONS` in `types/reports.ts`).

### Not persisted yet

`submitReport` in `services/reports.ts` only logs the draft in development. The migration and RPC exist but the client doesn't call them yet; the comment in that function shows the call to switch to once the migration is applied.

### One table for every report type

All reports go in a single `reports` table with a `target_type` enum and a polymorphic `target_id`, instead of one table per type. The analytics app needs one moderation queue, sorted and filtered the same way across types, and the columns a moderator works with (reason, details, status, reviewer, resolution) are identical for all three. The cost is that `target_id` can't have a foreign key, so `submit_report` validates that the target exists.

`submit_report` also stores:

- `reported_user_id`: the user, the activity host, or the post author, so moderators can see every report against one person whatever was reported.
- `target_snapshot`: the name, title, caption, or image paths at report time, because reported content is often deleted before review.

A reporter can have only one open (`pending` or `reviewing`) report per target. Reporting again while one is open returns the existing report instead of failing. The `report_target_summary` view groups reports per target for a most-reported-first queue.

### Access

Clients have no direct access to `reports`. Inserts go through the `submit_report` security-definer function, and the analytics app reads with the service-role key. If that app later signs in as a regular user, it will need a moderator role and an RLS policy.

## Relevant files

- `components/report/overflow-menu.tsx`: the shared three-dot menu, plus `openReport` for screens that already have their own menu
- `components/report/report-form.tsx`, `app/report.tsx`: the report screen
- `types/reports.ts`: target types, reasons, and labels
- `services/reports.ts`: `submitReport`, a stub for now
- `supabase/migrations/20261026120000_reports.sql`: table, enums, `submit_report`, `report_target_summary`
- Entry points: `components/explore/post-card.tsx`, `app/post/[id].tsx`, `app/profile/[id].tsx`, `app/shared-profile/[id].tsx`, `app/activity/[id].tsx`
