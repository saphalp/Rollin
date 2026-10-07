# First-login tutorial

## Purpose

Introduce the main Rollin user flow after a signed-in user completes their profile. Users can move forward and backward, skip the guide, and replay it later.

## User flow

1. Sign up and verify the emailed code, or log in with an existing account.
2. Complete the profile (name, university, and major) if required.
3. On entering the main tabs, Rollin checks whether this account has finished or skipped the tutorial.
4. The six screens explain Home discovery; joining and saving activities; Calendar and Post; Rides; Chats and Notifications; and Profile.
5. Next and Back change pages. Skip works on any page. Start exploring finishes the final page.
6. After dismissal, the main tabs, push registration, and ride-rating reminders become available.
7. App Tutorial in the avatar menu or profile settings reopens the guide at page one.

## Persistence and failures

The app saves `rollin_tutorial_v1` in Supabase Auth user metadata using `auth.updateUser`. It contains `outcome` (`completed` or `skipped`) and `finished_at`. Both outcomes suppress future automatic display. This is a user preference, never an authorization control. No database migration, new API key, or dashboard setting is needed.

The check uses `auth.getUser` so completion carries across devices and reinstalls. Existing accounts without this preference also see the guide once after this feature ships. Replay does not change the saved preference.

A lookup failure or eight-second timeout shows the guide instead of blocking indefinitely. A failed save displays an error and permits retry or Continue without saving. Continuing without saving dismisses the guide for the current tab-layout mount; it can appear again later. A late lookup cannot reopen the guide after this choice. Signing into a different account resets the check.

## Verification

Run `node --test scripts/test-tutorial.cjs`, `npx tsc --noEmit`, and lint the changed files. Automated tests use mocked Supabase calls; live-account persistence still needs a device smoke test.

Device smoke test:

1. Use an account with no `rollin_tutorial_v1` metadata and finish profile setup. Verify the guide appears before the tabs.
2. Check all six pages, Back, readable text with larger font settings, and Start exploring.
3. Sign out and back in. The guide should stay dismissed. Check the same account on another device.
4. Open App Tutorial from both profile menus and verify replay starts at page one and returns to the prior screen.
5. With a second account, use Skip on the first page. Verify it also stays dismissed after login.
6. Simulate offline save failure. Verify feedback, retry, and Continue without saving. Confirm the app remains usable.

## Files

- `lib/tutorial.ts`: account preference reads and writes.
- `components/tutorial/tutorial-steps.ts`: tutorial content.
- `components/tutorial/tutorial.tsx`: reusable guide interface.
- `components/tutorial/first-login-tutorial.tsx`: automatic display and loading lifecycle.
- `app/tutorial.tsx`: protected replay route.
- `app/(tabs)/_layout.tsx`: tutorial gate before the main app tabs.

## Standup scope

This implements the tutorial story: document the user flow, create the tutorial, make it skippable and shown once per account, and document the behavior. Signup email-code verification was implemented separately. It is not a second-factor login challenge. Password-guess timeout enforcement and Google Calendar export remain separate work.
