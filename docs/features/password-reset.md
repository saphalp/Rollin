# Password Reset

## Purpose

The purpose of this feature includes the following:

- Users may forget their password and lose access to their accounts
- Users may want to change their password

## Assumptions

The assumptions made for this feature include:

- The user has access to the email associated with their account
- Supabase authentication is working and available
- The rollin-app.org domain and Resend configuration remains configured correctly
- The user enters the code before it expires
- Supabase continues supporting the recovery token method utilized
- The recovery screen receives the email address from the previous screen.

## Decisions

### Dedicated email screen 

Originally, the email was grabbed straight from the login email text box. This required the user to input their email into the login email text box, and it was easy to misclick the Forgot Password button which would immediately send an email to the user. The separate screen allowed the user to intentionally input their email, as well as prevent accidental recovery emails.

### Numeric recovery code

Initially the Forgot Password feature was implemented through Supabase's default password recovery method. However, this method sent a link to the user that redirected them to a localhost link. The link was meant to redirect to the Rollin application, but during development the app was not registered and therefore could not be routed to directly. Using a numeric code allows the user to receive the email on any device rather than forcing them to use their phone. Additionally, tt works directly within the application and avoids using a website or app redirect.

### Sign-out after password reset

After verifying a recovery code, Supabase creates a temporary session for the affected user. We chose to force a sign-out after this session is created in order to take the user back to the login page to sign in with their new password.

## Technical Hurdles

### Localhost recovery link

The original Supabase recovery email used a link that redirected to the configured authentication Site URL, which was set to localhost during development. Because no recovery webpage was running at that address the user could not continue the password reset process.

### Branded email delivery

The team wanted to send correspondence, including password recovery codes, with Rollin branded domains. However, in order to achieve this, we had to do the following:

- Purchase the domain rollin-app.org on Porkbun
- Create an account with Resend and verify our domain
- Add DKIM, SPF, and DMARC DNS records through Porkbun
- Configure Resend SMTP credentials in Supabase
- Change the sender to no-reply@rollin-app.org
- Modify the Supabase recovery email template to send a numeric token

## Feature Workflow

1. The user presses the Forgot Password button from the login screen
2. The app navigates to a screen where the user enters the email associated with their account
3. The user submits the email
4. The app sends a password recovery request to Supabase
5. After Supabase accepts the request, the app navigates to the code-verification screen
6. If the email belongs to an account, Supabase uses Resend to deliver the recovery email
7. The user receives the email and enters the code
8. Supabase verifies the code, and the app displays the new-password screen
9. The user enters and confirms the new password
10. The app updates the password, ends the recovery session, and returns the user to the login screen

## Interface Details

### Forgot-password email screen

- Email-address text field
- Email keyboard
- Send Reset Code button
- Loading state while the request is sent
- Error message if the request cannot be completed
- Back to Login control
- Keyboard-aware scrolling
- Rollin-themed coloring

### Verification screen

- Displays the recovery email without allowing it to be edited
- Numeric code field
- Verify Code button
- Loading state during verification
- Inline invalid/expired-code message
- Back to Login control
- Rollin-themed coloring

### New-password screen

- New-password field
- Confirm-password field
- Eye icons for showing or hiding both passwords
- Minimum password requirements
- Mismatched-password validation
- Same-password error
- Submit button
- Success confirmation
- Return to login
- Rollin-themed coloring

## Relevant Files

- `app/(auth)/forgot-password.tsx` - collects the account email and requests the recovery code
- `app/reset-password.tsx` - verifies the recovery code and updates the password
- `components/auth/login.tsx` - provides the Forgot Password entry point
- `components/profile/ResetPasswordButton.tsx` - starts password recovery from the user profile
- `providers/auth-provider.tsx` - manages authentication state during recovery
- `app/_layout.tsx` - controls protected navigation while the recovery flow is active