# Interactive first-login tutorial

## User flow

The guide follows discover -> join or host -> arrange transportation -> coordinate -> revisit your plans. Each page starts with a floating overview note anchored to its actual bottom-tab icon. The note overlays the page without changing navigator or tab-bar height. Calendar places its overview beneath the calendar grid and legend and Notifications uses the bell, because those pages have no bottom tab.

Next progresses from each overview into its page details. Six navigation practice steps then ask the user to tap the actual Explore, Rides, Chats, or Profile tab, the calendar icon, or the notification bell. These steps hide Next and advance only after the requested route opens. There is no Show highlights/Next page branch. Back revisits the preceding step; Skip still dismisses the entire tour.

1. Home: overview, search, categories and joining/saving.
2. Explore: overview, activity photos and shared posts.
3. Calendar: overview, date markers and activity lists.
4. Post: overview, starting an activity form.
5. Rides: overview, find/offer ride actions.
6. Chats: overview, direct and activity conversations.
7. Notifications: overview, reviewing updates and requests.
8. Profile: overview, created/joined activities, avatar/account options.

Overviews leave the page undimmed and usable. Detail steps focus the relevant section and dim its surroundings. Navigation practice uses four touch-blocking regions around the highlight, leaving the real control inside it touchable. It does not simulate the tap with a second navigation button. If the user navigates away during an overview, Return to this page restores its route. Back and Skip remain available during practice. The tour itself never publishes, joins, or sends anything; actions users choose on the live page behave normally. Empty accounts can complete the guide.

Prompt text appears immediately; advancing never waits for a timer or exit animation. Native target coordinates are measured on animation frames, with no settling delay or loading-message timeout. Tab targets measure the native tab buttons, including both icons and labels, and stay registered even when their tabs are inactive. No extra wrapper changes the tab layout. Section highlights include their headings; My Activities is measured together with Created/Joined. Header icons use matching boxes with font padding disabled. Cutouts clip only at viewport edges; safe-area insets position the notes without shifting highlight centers. Ordinary page targets still unregister when unfocused. Missing measurements never block the prompt or the navigation controls.

Notes use their natural content height, full available width, and concise copy. There is no internal ScrollView or fixed card-height cap. The layout measures the resulting card to position it within the safe area and away from navigation targets.

App Tutorial in either profile menu replays the tour from Home. Replay ends on the current tour screen, not the screen where it was launched. Push permission requests, ride location permission requests, and rating reminders are deferred while touring.

## Persistence and failures

Supabase Auth user metadata `rollin_tutorial_v2` stores `outcome` (`completed` or `skipped`) and `finished_at`. Both outcomes suppress automatic display on later sessions and devices. This is a preference, never an authorization control. No migration, new key, or Supabase dashboard change is needed.

The version changed from v1 so users who saw the old slideshow receive the interactive tour once. Existing accounts without v2 also see it once. Replay does not rewrite the preference.

A failed lookup or eight-second timeout starts the tour. A failed save offers retry or Continue without saving, which dismisses it for the current session but may show it next time. Late lookup responses cannot reopen a dismissed tour. Signing into a different account resets the check.

Targets register only while their screen is focused. The overlay waits for navigation/layout, measures native window coordinates relative to its own origin, and follows layout changes. Prompt text is independent of target measurement and has no loading state. When a target fills a small viewport, the explanation takes priority over a cutout; the card grows with its content.

Tutorial buttons use native wrapping Text inside Pressable controls with no line limit or ellipsis. They have a minimum touch height, grow with their labels, and Back/Next stack on narrow screens or with larger system text. The card grows to contain its text and controls.

## Verification

Automated checks: `node --test scripts/test-tutorial.cjs scripts/test-signup-verification.cjs`, `npx tsc --noEmit`, tutorial ESLint, Android export. Tests cover account persistence, navigation, Back, completion, replay, failed saves, late/unmounted lookups, and spotlight placement.

Device smoke test still required:

1. Sign in with an account without v2 metadata and complete profile setup. Confirm the Home overview floats above the Home icon and leaves the live page at its normal size.
2. Visit all eight page overviews and their detail sequence. At each navigation practice step, tap the highlighted real control and confirm it opens the page and advances exactly once. Tap outside the highlight to confirm it cannot activate another control. Confirm the tab bar never moves and each overview arrow points to its tab icon (or header anchor). Confirm each cutout aligns, targets scroll into view, and each page finishes its details before moving on. Check Back and Android hardware Back. Check that prompts appear immediately, including the first inactive Explore tab step.
3. Rotate the phone and increase font size. Verify full Back/Next labels remain visible (never ellipsized), controls stack when needed, and every note shows its complete text and controls without internal scrolling.
4. Finish, sign out/in, and confirm it stays dismissed. Repeat with Skip on another account.
5. Replay from both profile menus and check it starts on Home. Verify tutorial navigation itself does not change activities, rides, messages, or notification status.
6. Test an empty account and unavailable network. Confirm Next/Skip remain usable if a target cannot load and a failed save permits continuation.

## Files

- `lib/tutorial.ts`: account preference reads and writes.
- `components/tutorial/tutorial-steps.ts`: content, routes, spotlight placement.
- `components/tutorial/guided-tour-provider.tsx`: navigation and account lifecycle.
- `components/tutorial/tour-target.tsx`: target registration and automatic scrolling.
- `components/tutorial/tutorial.tsx`: dimmed overlay, cutout, and explanation controls.
- `app/tutorial.tsx`: protected replay launcher.
- `app/_layout.tsx`: provider above the live navigator.

This covers the tutorial story. Login rate limiting and Google Calendar export remain separate work.
