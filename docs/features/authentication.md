# Accounts and Sign-in

Users can create a Rollin account with an email address and password, or sign in with Google. Supabase handles the account and keeps the user signed in between app visits.

## Signing up

1. Enter an email address and choose a password.
2. Check that inbox for the signup code.
3. Enter the code in Rollin to confirm the email.
4. Complete any required login-code check, then fill out the profile.

Someone who tries to log in before confirming their email is sent back to the confirmation screen. That screen includes **Resend code**, with a 60-second wait after a send or rate-limit response. It also shows when a code is invalid, expired, or could not be sent.

The email field checks for a valid email format. A university email can earn the educational-email badge, but the mobile form does not treat every non-university address as invalid.

## Signing in

For email login, enter the account email and password. For Google login, choose a Google account and return to Rollin when the sign-in finishes.

When emailed login verification is enabled in the backend, a new session asks for a separate code before opening the app. An approved session stays signed in when the user closes and reopens Rollin. See [Email Login Verification](login-email-verification.md) for its setup, limits, and on/off switch.

The app then checks the profile. New users finish profile setup; users with completed profiles go to the main tabs. **Forgot Password** opens the [password reset flow](password-reset.md).

## Why we use email codes

Codes let people open their email on any device and type the result into Rollin. They also avoid the redirect problems we had with email links during development.

In Supabase, keep **Confirm email** enabled and use `{{ .Token }}` in the **Confirm sign up** email template. The app verifies signup codes with `verifyOtp` using type `email`; resend uses type `signup`. A template that still contains only a link will not match this screen.

Resend delivers our branded emails from `no-reply@rollin-app.org`. Google sign-in still needs its redirect settings to agree between the app, Google, and Supabase.

## University verification

The app displays the `is_educational_email` result saved on the profile. The university lookup was designed around Hipolabs, which lists university email domains. A server check must compare the returned domains rather than assuming the API filtered them correctly. Student subdomains also need care: a school may list `usc.edu` while a student uses `cs.usc.edu`.

That verification setup is outside this mobile repository. Check the shared Supabase configuration before recreating it. The badge result should come from the server rather than a decision made by the phone.

## Main files

| File | What it does |
|---|---|
| `components/auth/login.tsx` | Email and password login |
| `components/auth/EmailCard.tsx`, `components/auth/PasswordCard.tsx` | Signup inputs |
| `components/auth/SignInWithGoogle.tsx` | Google sign-in |
| `app/(auth)/EmailConfirmation.tsx` | Signup code entry and resend |
| `providers/auth-provider.tsx` | Restores the session and loads the profile |
| `app/_layout.tsx` | Chooses the login, verification, profile-setup, or main screens |
| `lib/supabase.ts` | Connects the app to Supabase |
