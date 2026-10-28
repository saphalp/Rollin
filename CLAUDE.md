# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

Rollin is an Expo React Native app (SDK 58, Expo Router, TypeScript, React Native Paper) backed by Supabase (auth, Postgres, storage, realtime, edge functions). It helps college students discover activities, connect with other students at their university, and coordinate rides. Full developer docs live in `docs/` (published to https://rollin.readthedocs.io) — read the relevant page there before a non-trivial change to a feature area; this file only covers what an agent needs to get oriented and avoid repeating past mistakes.

## Commands

```bash
npm install                 # postinstall runs patch-package; patches/ is currently empty
npx expo start               # start the dev server (android/ios/web options in the Expo terminal)
npm run android               # expo run:android
npm run ios                   # expo run:ios
npm run web                   # expo start --web
npm run lint                  # expo lint (flat config in eslint.config.js)
npx tsc --noEmit               # type-check; no dedicated npm script
```

There is no `npm test`. Tests are standalone Node scripts under `scripts/test-*.cjs` that transpile the relevant `.ts`/`.tsx` source with the TypeScript compiler API and run it in a `vm` sandbox with hand-written mocks (no Jest, no React Native test renderer). Run one directly:

```bash
node --test scripts/test-ride-navigation.cjs
```

`scripts/test-ride-database.cjs` additionally needs an installed `@electric-sql/pglite` (not a committed dependency) and is invoked as `PGLITE_MODULE=<path-to-pglite> node --test scripts/test-ride-database.cjs`. Any file in `patches/` is pinned to an exact package version and makes `npm install` fail (`postinstall` runs `patch-package --error-on-fail`) once that package is upgraded — update or remove patches in the same change as the upgrade.

Supabase Edge Functions (`supabase/functions/`) are excluded from `tsc`/the lint config — they're Deno, not Node. There's no CI that applies migrations or deploys functions; both are done manually against the Supabase project (SQL editor or `supabase db push` for `supabase/migrations/*.sql`; `supabase functions deploy <name>` for edge functions, with secrets set via `supabase secrets set` or the dashboard — never via `.env`).

## Architecture

**Data flow:** screen or component → `services/` or `lib/` → Supabase → updated local state. Authorization is enforced by Supabase RLS policies, not by trusting the client.

**Routing/auth gating** (`app/_layout.tsx`, `providers/auth-provider.tsx`, `hooks/use-auth-context.ts`): `AuthProvider` loads Supabase auth claims, then the matching `profiles` row, and exposes `isLoggedIn` / `isProfileComplete` via `AuthContext`. `RootNavigator` uses Expo Router's `Stack.Protected` to route between three mutually exclusive states: logged-in + complete profile → `(tabs)` and the rest of the main app; logged-in + incomplete profile → `(onboarding)`; logged out → `(auth)`. A screen's visibility is controlled by which `Stack.Protected` guard it sits under in that file, not by per-screen checks.

**Directory layout:**
- `app/` — Expo Router screens/route groups; keep these thin (navigation params, page-level state, composition) and push reusable behavior down into `components/`/`hooks/`/`services/` (component-first convention).
- `components/` — reusable UI, organized by feature subfolder (`components/profile/`, `components/rides/`, etc).
- `hooks/` — reusable React state/data-loading logic.
- `services/` — domain/backend operations, concentrated around ride-sharing (`services/ride-*.ts`).
- `lib/` — shared infrastructure: the Supabase client (`lib/supabase.ts`), profile-specific Supabase calls (`lib/profile/*.ts`), campus events, recurrence, tutorial helpers.
- `providers/` — app-wide context providers.
- `constants/theme.ts` — colors (light/dark) and fonts; see Design system below.
- `types/` — shared TypeScript types, split by domain (`types/rides.ts`, `types/driver.ts`).
- `navigation/` — helpers for complex multi-step navigation flows (e.g. ride navigation deep links).
- `supabase/migrations/` — plain SQL migrations, applied manually (see Commands).
- `supabase/functions/` — Deno edge functions; use these for anything needing a server-side secret (never ship an API key to the client). Pattern: client calls `supabase.functions.invoke('fn-name', { body })`; the function reads the forwarded `Authorization` header and creates its own Supabase client scoped to the caller's RLS permissions for user-authenticated calls (see `ride-route`, `didit-create-session`), or uses the service-role key only for truly unauthenticated callers like a third-party webhook (see `didit-webhook`).
- `docs/` — the Read the Docs source; `docs/architecture.md`, `docs/backend.md`, `docs/design-system.md`, `docs/development-workflow.md`, and `docs/features/*.md` (one per major feature, each documenting purpose/assumptions/decisions/relevant files) are worth reading before working in that area.

**Backend/Supabase:** after auth, the app loads the matching `profiles` row for app-specific data (name, university, major, avatar path, profile-completion flag, etc). Key tables: `profiles`, `activities`, `rsvps`, `activity_join_requests`, `follows`, `interests`/`profile_interests`, `conversations`/`conversation_participants`/`messages`, `notifications`, `rides_offered`, `ride_requests`, `ride_wanted_requests`, `ride_locations`, `driver_profiles`, `campus_events`. Uploaded images go to Supabase Storage (`avatars`, `activity-images` buckets); profile/activity rows store the object path, and helper functions resolve it to a public URL. Supabase Realtime drives chat, notifications, follow-state, ride offers/requests, the ride dashboard, and live driver locations.

**Design system** (`constants/theme.ts`, `docs/design-system.md`): `Colors.light`/`Colors.dark` define the palette (electric blue `#0058be` tint, `#f0f3fa` background, `#10B981` verified-badge green, etc) and `Fonts` defines the type family (Nunito Sans). `react-native-paper` is the primary component library for newer form UI (`TextInput`, `Button`); screens should pull colors from `Colors[colorScheme]` rather than hardcoding, and match `react-native-paper`'s theme (set up in `app/_layout.tsx`) by passing explicit `textColor`/`buttonColor`/`outlineColor` — an unstyled Paper `Button` falls back to the Material default accent (a washed-out purple), not this app's blue tint. The custom `AppText` component (`components/text.tsx`) has type-based base styles (`default`, `title`, etc) with their own `lineHeight`; overriding `fontSize` on an `AppText` without also overriding `lineHeight` will visually clip the text — always set both together for custom sizes.

**No emoji in UI.** Use `IconSymbol` (`components/ui/icon-symbol.tsx`) or another proper icon component instead of emoji characters in any screen/component copy — add a new `IconSymbol` mapping entry if the icon you need isn't there yet. A few emoji already exist in older code (`🔁` in `app/(tabs)/index.tsx`, `app/activity/[id].tsx`, `components/activity-card.tsx`) — leave those unless asked, but don't add new ones.

**Picker/dropdown fields.** `@expo/ui` is not installed in this project. For a tap-to-pick field (a date, a value from a list), follow the existing pattern in `components/post/date-time-field.tsx` / `components/profile/SelectField.tsx`: a labeled field that opens a `Modal` sheet (Cancel/Done header on iOS, native control on Android where applicable) styled with this app's own theme — not a new picker dependency.
