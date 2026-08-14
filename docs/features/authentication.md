# Authentication

## Purpose

- A user can create an account with an email address and password.
- A user can sign in with Google OAuth so that they do not have to set up a separate password.
- A user can confirm ownership of their email before continuing into the application.
- The application can display the educational-email verification status stored on the user's profile.

## Assumptions

- The user has access to the email address used to create the account.
- Supabase authentication and the configured email provider are available.
- Google OAuth remains configured in both Google and Supabase.
- Any educational-email verification performed outside the mobile client remains configured in the Supabase project.

## Decisions

- **Supabase for auth.** It gives us email/password and Google OAuth out of the box, plus a place to run server-side logic (edge functions).
- **Email confirmation before normal sign-in.** Supabase sends the confirmation email and verifies that the user owns the address used to create the account.
- **Educational verification should run server-side.** The mobile client reads the resulting `is_educational_email` value from the profile instead of deciding whether a user is verified. The server-side implementation is configured outside this repository and must also be configured when the backend is recreated.
- **Hipolabs for educational-domain lookup.** The verification design uses the free Hipolabs Universities API to compare an email domain with known university domains without placing that decision in the client application.

## Technical Hurdles

- **Subdomains in student emails.** Some schools issue addresses like `student@cs.usc.edu`, but Hipolabs only stores the root domain (`usc.edu`). We strip the subdomain down to the root before matching, or the lookup fails for legitimate users.
- **Email-confirmation redirection.** Testing a redirect back into the application requires a development or production build with the app's route registered. Expo Go cannot represent the final redirect behavior by itself.
- **Google OAuth redirection.** The redirect URL must agree across the application, Google OAuth configuration, and Supabase authentication settings before the user can return to Rollin successfully.

## Feature Workflow

### Email and password

1. The user enters an email address and password.
2. Supabase creates the account and sends an email-confirmation message.
3. The user confirms ownership of the email address.
4. After the user signs in, the authentication provider restores the Supabase session and loads the associated profile.
5. The application routes the user to profile completion or the main tabs based on the current profile state.

### Google OAuth

1. The user chooses Google sign-in.
2. Google handles account selection and authentication.
3. The OAuth redirect returns the user to Rollin and Supabase creates the authenticated session.
4. The application loads the user's profile and continues to profile completion or the main tabs.

Educational-email verification, when configured in Supabase, runs outside the mobile client and stores its result in the profile's `is_educational_email` field.

## Interface Details

### Sign-in
Rollin wordmark header with tagline, hero banner, email + password fields (password has show/hide eye), forgot-password control, Log In button, OR divider, Google sign-in, Sign Up control.
 
### Sign-up: Email step
Email field with university-email helper text, Next button, OR divider, Google sign-in, Log In control.
 
### Sign-up: Password step
Password field; creates the account on submit.

### Password recovery
The sign-in screen links to the separate [Password Reset](password-reset.md) workflow.
 
### Email confirmation
Solid blue background (not theme-aware), envelope illustration, "Check your inbox" message, Resend link, Back to Login button.

### Hipolabs Universities API

- Base endpoint: `http://universities.hipolabs.com/search`
- No authentication or API key required.
- Query parameters: `name`, `country`, and `domain`
- The verification design treats a domain as valid when it appears in the `domains` array of a returned record.
- This lookup is not implemented in the mobile-client repository and depends on the separate Supabase-side configuration.

## Relevant Files

| File | Role |
|---|---|
| `lib/supabase.ts` | Creates and configures the Supabase client |
| `app/(auth)/_layout.tsx` | Defines the unauthenticated route layout |
| `app/(auth)/index.tsx` | Displays the main sign-in and sign-up screen |
| `app/(auth)/EmailConfirmation.tsx` | Displays the post-signup email-confirmation screen |
| `app/(auth)/forgot-password.tsx` | Collects the email used to request password recovery |
| `components/auth/login.tsx` | Implements the login form logic and interface |
| `components/auth/EmailCard.tsx` | Implements the email-entry step |
| `components/auth/PasswordCard.tsx` | Implements the password-entry step |
| `components/auth/SignInWithGoogle.tsx` | Starts Google OAuth sign-in |
| `components/auth/AuthHeader.tsx` | Displays the shared authentication header |
| `components/auth/ImageContainer.tsx` | Provides shared authentication-screen artwork and layout |
| `components/auth/TermsFooter.tsx` | Displays the terms and privacy footer on authentication screens |
| `components/auth/LogoutButton.tsx` | Signs the current user out |
| `providers/auth-provider.tsx` | Restores sessions, loads profiles, and exposes authentication state |
| `app/_layout.tsx` | Routes users according to authentication and profile state |
