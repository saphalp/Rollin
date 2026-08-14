# Authentication

## Purpose
- A user can create an account with their email address.
- A user can create an account with Google OAuth, so that they don't have to set up a password.
- Only users with a valid educational (`.edu` or equivalent) email domain should be able to finish signing up.

## Assumptions
- The user will only use their email to create an account
- The user signs up with an email tied to a real university to be a verified user.
- The user's educational domain exists in the Hipolabs dataset used for verification.

## Decisions
- **Supabase for auth.** It gives us email/password and Google OAuth out of the box, plus a place to run server-side logic (edge functions).
- **Hipolabs for domain verification.** It is free and doesn't need API key, and returns university name, country, and domains as JSON.
- **Verification runs server-side.** The domain check is handled by a Supabase edge function so it can't be skipped or faked.
- **Check runs after email verification, not at signup.** We only check if educational domain actually exists after the user has proven that they own the email address.

## Technical Hurdles
- **The domain filter isn't reliable.** Hipolabs' filter has historically returned the full list instead of a match, so we don't trust it blindly — the function does its own exact match on the returned data instead of assuming the API filtered correctly.
- **Subdomains in student emails.** Some schools issue addresses like `student@cs.usc.edu`, but Hipolabs only stores the root domain (`usc.edu`). We strip the subdomain down to the root before matching, or the lookup fails for legitimate users.
- **Hipolabs is HTTP, not HTTPS.** The public endpoint isn't served over TLS. 

## Feature Workflow
1. User signs up with email/password or Google OAuth.
2. Supabase sends a verification email 
3. Once the email is verified, an edge function is triggered.
4. The function extracts the domain from the user's email and reduces it to its root domain.
5. It queries Hipolabs for that domain and checks the response for an exact match.
6. If matched, the account is marked as verified in the profiles table, else the account is marked not verified using a boolean.

## Interface Details

### Sign-in
Rollin wordmark header with tagline, hero banner, email + password fields (password has show/hide eye), forgot-password control, Log In button, OR divider, Google sign-in, Sign Up control.
 
### Sign-up · email step
Email field with university-email helper text, Next button, OR divider, Google sign-in, Log In control.
 
### Sign-up · password step
Password field; creates the account on submit.
 
### Forgot-password email
Email field (email keyboard), Send Reset Code button with loading state and error message on failure, Back to Login control.
 
### Verification
Shows the recovery email (read-only), numeric code field, Verify Code button with loading state, inline invalid/expired-code message, Back to Login control.
 
### New-password
New-password and confirm-password fields (both with eye toggles). On submit, enforces 8-character minimum and validates against mismatch and reuse. Submit button, success confirmation, return to login.
 
### Email confirmation
Solid blue background (not theme-aware), envelope illustration, "Check your inbox" message, Resend link, Back to Login button.

**Hipolabs Universities API**
- Base endpoint: `http://universities.hipolabs.com/search`
- No authentication or API key required.
- Query params: `name`, `country`, `domain` 
- We treat a domain as valid when it appears in the `domains` array of any returned record.

## Relevant Files
  ### Supabase client
  - `lib/supabase.ts` — Supabase client instance 

  ### Sign in / sign up
  - `app/(auth)/_layout.tsx` — layout for the unauthenticated route
  group.
  - `app/(auth)/index.tsx` — main sign-in/sign-up screen.
  - `app/(auth)/EmailConfirmation.tsx` — post-signup email
  confirmation screen.
  - `app/(auth)/forgot-password.tsx` — forgot-password request
  screen.
  - `components/auth/login.tsx` — login form logic/UI.
  - `components/auth/EmailCard.tsx` — email input step.
  - `components/auth/PasswordCard.tsx` — password input step.
  - `components/auth/SignInWithGoogle.tsx` — Google OAuth sign-in.
  - `components/auth/AuthHeader.tsx` — shared header for auth
  screens.
  - `components/auth/ImageContainer.tsx` — shared auth-screen
  artwork/layout.
  - `components/auth/TermsFooter.tsx` — terms/privacy footer shown
  on auth screens.
  - `components/auth/LogoutButton.tsx` — sign-out action.
