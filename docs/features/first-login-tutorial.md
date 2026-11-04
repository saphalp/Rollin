# First-login Tutorial

The tutorial shows new users how to get around Rollin. Each page starts with a short overview, then points out the main controls. Some steps ask the user to tap the real tab or icon so they get to try it themselves.

## What it covers

1. **Home:** finding activities, searching, and saving or joining something.
2. **Explore:** viewing activity photos and shared posts.
3. **Calendar:** checking dates and the plans shown underneath.
4. **Post:** starting a new activity.
5. **Rides:** finding or offering a ride.
6. **Chats:** direct messages and activity group chats.
7. **Notifications:** updates and requests.
8. **Profile:** hosted and attended activities, profile options, and account settings.

**Next** moves from a page overview into its details. **Back** returns to the previous step, and **Skip** closes the tour. When a step asks the user to open a tab or tap an icon, it waits for that action instead of showing Next.

Users can replay the tour from **App Tutorial** in the profile menu. It starts at Home and leaves them on the final tour page when they finish.

## How the highlights work

An overview leaves the page visible. Detail steps dim the surrounding screen and leave the relevant section highlighted. The app measures the actual control on the screen, including its icon, label, or section heading, so the highlight can follow its position.

The explanation sits outside the highlighted area. Tab notes sit above the matching tab, and the Calendar overview sits below the calendar and its legend. The tutorial does not push the bottom bar upward. Its white card grows to fit the text and buttons without an internal scroll area.

The prompt appears right away. It does not wait for a timer or for Supabase to fetch tutorial text. The page underneath may still be loading its own data. During a practice step, taps outside the highlighted control are blocked; Back and Skip remain available.

We delay push-permission requests, ride location prompts, and rating reminders while the tour is open so they do not interrupt it.

## Remembering completion

Finishing or skipping saves the choice on the user's Supabase account under `rollin_tutorial_v2`. It stores the outcome and completion time, so the tour stays dismissed on later logins and other devices. Replaying it does not change that saved choice.

The version changed when we replaced the old slideshow with this interactive tour. Accounts that only completed the slideshow see the newer tour once.

If loading the preference fails or takes more than eight seconds, the app starts the tour. If saving fails, the user can retry or continue without saving. Continuing dismisses it for that session, but it may appear again next time. Changing accounts runs the check for the new account.

This is a saved preference, not an account security check. It needs no extra SQL or server key.

## Checking changes

```powershell
node --test scripts/test-tutorial.cjs scripts/test-signup-verification.cjs
```

On a phone, go through all eight pages. Check that the highlights cover the whole control, page overviews leave the important content visible, and tapping a highlighted tab advances once. Try Back, Skip, replay, an empty account, and a failed connection. Increase the phone's text size and check that every prompt and button still fits.

Finish on one account and skip on another, then sign out and back in to confirm both choices were saved.

## Main files

- `components/tutorial/tutorial-steps.ts`: text and order of the tour.
- `components/tutorial/guided-tour-provider.tsx`: starts the tour and moves between steps.
- `components/tutorial/tour-target.tsx`: measures the controls to highlight.
- `components/tutorial/tutorial.tsx`: highlight, dimmed area, and explanation card.
- `lib/tutorial.ts`: loads and saves completion.
- `app/tutorial.tsx`: opens the tour again from the profile menu.
