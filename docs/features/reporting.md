# Reporting a Problem

Users can report a person, activity, or Explore photo post. The team reviews reports in the separate Rollin Analytics app.

## Send a report

1. Open the three-dot menu on the profile, activity, or post and choose **Report**.
2. Choose a reason and add details if needed. Details can be up to 1,000 characters.
3. Review the summary and confirm.
4. The app shows that the report was submitted for review.

You cannot report yourself or your own content. The reported person is not told who sent the report. If submitting fails, the app explains a known problem, such as deleted content, or asks the user to retry.

## What is saved

All report types share one `reports` table so moderators can review them in one list. Each report includes the reason, optional details, target, reported user, and review status.

The server also keeps a copy of the relevant name, title, caption, or image paths at the time of reporting. That gives moderators some context if the original content is later removed.

A person can have only one open report for the same target. Submitting it again while it is pending or under review returns the existing report. The `report_target_summary` view groups reports so moderators can find frequently reported content.

## Access and setup

The app calls `submit_report` rather than writing to the table directly. That function checks that the content exists and does not belong to the reporter. Different target types share an ID field, so these checks cannot rely on one ordinary foreign-key relationship.

The analytics backend uses service-role access to read the moderation queue. That key must stay on its server. If the dashboard later uses regular signed-in database access, it will need a moderator role and suitable access rules.

The setup is in `supabase/migrations/20261026120000_reports.sql`.

## Main files

- `components/report/overflow-menu.tsx`: shared menu and report action.
- `app/report.tsx` and `components/report/report-form.tsx`: report screens.
- `types/reports.ts`: reasons and labels.
- `services/reports.ts`: submits the report.

Test each report type, optional details, a failed request, and reporting the same content twice. Check that users cannot report their own content or read other people's reports.
