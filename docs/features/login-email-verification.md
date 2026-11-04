# Email Login Verification

When this feature is enabled, signing in with a password or Google is followed by an emailed code. The user enters it on **Verify your login** before opening Rollin. Approved sessions stay signed in across app restarts. Logging out or using another device requires a new approval.

Signup confirmation and password recovery still use their own Supabase emails. A signup that starts a new session can also reach the login-code screen. **Back to login** signs out only the current device.

## Code limits

- Codes last ten minutes and can be used once.
- Five wrong guesses invalidate the code.
- Sending a new code replaces the old one.
- Resend has a 60-second wait, with at most five sends in 15 minutes and 20 per day per account.

These limits apply to login codes. They do not implement the separate password-attempt lockout story.

## Turning it on or off

The backend setting `require_login_code` controls this feature. It defaults to on. After the two login-email migrations, apply `supabase/migrations/20261030130000_login_code_toggle.sql` to add the switch.

Then use the Supabase SQL Editor to change it:

```sql
-- Allow password or Google sign-in without the extra code:
update login_security.settings set require_login_code = false;

-- Require a code again:
update login_security.settings set require_login_code = true;
```

The app checks the setting during sign-in, launch, and session refresh; no new app release is needed. With it off, a valid signed-in session passes the login check. With it back on, sessions that never verified a code lose access to protected requests until they do. An app that is already open may stay on its current screen until its next check.

Users cannot change this setting from the app. It lives in the private `login_security` database schema.

## What this protects

We built a custom email check around access to Rollin's data. The server saves approval against the Supabase session ID and current email. A flag on the phone or editable profile metadata cannot approve a session.

After enforcement is enabled, database access checks and the updated server functions reject unapproved sessions. Existing rules still decide who owns an activity, belongs to a chat, or can offer a ride.

This is **not Supabase's built-in MFA**. Supabase creates its normal first-step session, called AAL1, before our code check. Its own account-management endpoints are outside this extra check. Someone who knows the password may still perform operations that Supabase Auth allows at that level, including password changes. Public content also remains public. Do not describe the feature as complete protection against account takeover or as an AAL2 session.

## Backend setup

Check which steps are already installed before changing the shared project. Enabling enforcement affects everyone using it, including older app builds that do not have the code screen. Make the updated app available to the team and test email delivery before enabling that step.

### 1. Add the verification tables and functions

Run the complete `supabase/migrations/202610140001_login_email.sql` file in Supabase's SQL Editor. It creates the private verification data and server-only functions. Sessions already present when this file runs are approved once so existing users can stay signed in. Later sessions need their own approval.

Do not run the enforcement file yet. If the team uses the migration CLI instead of the SQL Editor, follow that workflow and check the recorded migration history first.

### 2. Add server secrets

In **Edge Functions → Secrets**, set:

| Name | Value |
|---|---|
| `RESEND_API_KEY` | A Resend key allowed to send from the verified Rollin domain |
| `LOGIN_EMAIL_FROM` | `Rollin <no-reply@rollin-app.org>` |
| `LOGIN_CODE_SECRET` | A new random secret of at least 32 characters |

Generate a secret with:

```powershell
node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex'))"
```

Copy it directly into the secret field. Keep all three settings on the server, outside the repository and `EXPO_PUBLIC_` variables. Supabase supplies the function's project URL and service-role credentials.

Login emails are sent through Resend's API. They do not use the signup or password-reset templates, so those templates do not need changing for this feature.

### 3. Deploy the functions

Replace `YOUR_PROJECT_REF` with the intended project's reference ID:

```powershell
npx supabase login
npx supabase functions deploy login-email --project-ref YOUR_PROJECT_REF
npx supabase functions deploy announce --project-ref YOUR_PROJECT_REF
npx supabase functions deploy leave-activity --project-ref YOUR_PROJECT_REF
npx supabase functions deploy ride-route --project-ref YOUR_PROJECT_REF
npx supabase functions deploy notify-message --project-ref YOUR_PROJECT_REF
npx supabase functions deploy didit-create-session --project-ref YOUR_PROJECT_REF
```

These deploy backend functions; they do not push Git commits. The `login-email` function has gateway JWT verification disabled in `supabase/config.toml` because it verifies the supplied token itself with `getUser` and `getClaims`. The database also checks that the session still exists. Keep those checks inside the function.

### 4. Test, then enable enforcement

Test a fresh login, receiving a code, rejecting an incorrect code, and accepting the correct one in the updated app.

Once that works, run the complete `supabase/migrations/202610140002_enforce_login_email.sql` file. It adds the database/API checks. If the project already has a pre-request hook, the script stops instead of replacing it; the hooks must be combined before retrying.

Test again with enforcement on. Check activities, rides, chats, announcements, uploads, and driver verification. An unapproved session should be limited to the approval check through the Data API, while protected data and functions should work after verification. Also check that another device needs its own code and that an approved device stays signed in after reopening.

Email sends count toward Resend's allowance, and function calls count toward Supabase's allowance. This setup does not need a paid Auth hook, but the providers' sending and usage limits still apply.

## Adding more protected features

New user-facing Edge Functions need `requireVerifiedLogin` before privileged work. New tables also need a login check alongside their normal access rules, especially for access through Storage or Realtime:

```sql
create policy require_login_email on public.YOUR_TABLE
as restrictive for all to authenticated
using ((select public.login_email_verified()))
with check ((select public.login_email_verified()));
```

## Local checks

```powershell
npm install --prefix .expo/login-security-validation --no-package-lock --ignore-scripts @electric-sql/pglite@0.5.9
$env:PGLITE_MODULE = (Resolve-Path '.expo/login-security-validation/node_modules/@electric-sql/pglite').Path
node --test scripts/test-*.cjs
npx tsc --noEmit
npx expo export --platform android --output-dir .expo/login-email-export
```

The SQL tests use a temporary local PostgreSQL database. The function tests use fake Auth and Resend responses. They do not change Supabase or send email, so the device and delivery checks above are still needed.
