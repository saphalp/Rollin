# Password Reset

Users can reset a forgotten password from the login screen. They receive a code by email, enter it in Rollin, and choose a new password.

## How it works

1. Tap **Forgot Password** and enter the account email.
2. Tap **Send Reset Code**. If the address belongs to an account, a recovery email is sent.
3. Enter the code on the verification screen.
4. Enter the new password twice and save it.
5. Sign in again with the new password.

The app shows errors for an invalid or expired code, mismatched passwords, and a password that cannot be used. The password fields have show/hide controls. The screens adjust when the keyboard opens so the fields remain reachable.

## Why we changed the original flow

At first, Forgot Password used whatever was typed into the login email field and sent the request immediately. That made accidental taps easy. A separate email screen lets the user choose when to send it.

Supabase's default recovery email also used a link. Our development setup sent that link to localhost, where there was no recovery page. A numeric code works inside Rollin and lets the user read the email on a different device.

Verifying a recovery code creates a temporary Supabase session. We keep that session while changing the password, then sign out and return to login. This makes the final step clear: use the new password to sign in.

## Email setup

We bought `rollin-app.org` through Porkbun and use Resend to send email as `no-reply@rollin-app.org`. The setup involved verifying the domain with Resend, adding DKIM, SPF, and DMARC records in Porkbun, and entering the Resend SMTP settings in Supabase.

The Supabase **Reset password** template must include `{{ .Token }}` so the email contains a code. This is a different template from signup confirmation. Existing email and DNS settings need to remain in place for delivery to work.

The user needs access to their account email and must enter the code before it expires. Accepting a reset request does not guarantee an email was delivered, so test the full flow with an account you control after changing the email setup.

## Main files

- `app/(auth)/forgot-password.tsx`: asks for the email and requests a code.
- `app/reset-password.tsx`: verifies the code and saves the password.
- `components/auth/login.tsx`: opens recovery from login.
- `components/profile/ResetPasswordButton.tsx`: opens recovery from the profile.
- `providers/auth-provider.tsx` and `app/_layout.tsx`: keep the user in recovery until it is finished.
