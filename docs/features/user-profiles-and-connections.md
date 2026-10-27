# User Profiles and Connections

## Purpose

- Allow users to view their own profile, as well as profiles belonging to other users.
- Display identifying information such as name, university, major, profile picture, and interests.
- Allow users to create follow requests and direct messages.
- Give users access to activities they created and activities they joined.
- Provide account actions such as resetting a password and logging out.

## Assumptions

- The user is authenticated and has a row in the profiles table.
- A profile ID matches the user ID provided by Supabase Authentication.
- The profiles, follows, interests, profile_interests, activities, and rsvps tables are available.
- Profile pictures are stored in the Supabase avatars bucket.
- A fallback avatar is available when the user has not uploaded a profile picture.
- Cover pictures are stored in the same avatars bucket, under the user's own folder with a `cover-` filename prefix, so the bucket's existing per-user storage policies apply to them.
- A bundled default cover (`assets/images/default-cover.jpg`) is shown when the user has not uploaded a cover picture.
- Follow requests must be accepted before the users are considered connected.
- Direct-message conversations are created through the get_or_create_direct_conversation Supabase function.

## Decisions

- **One shared profile component.** UserProfile is used for both the signed-in user and other users. The component changes its controls depending on whether the displayed profile belongs to the current user.
- **Dynamic routes for other profiles.** Other users are opened through /profile/[id], which allows the same route to display any profile by its user ID.
- **Three follow states.** A connection can be not_following, requested, or following. These states make it possible to represent pending requests instead of treating following as a simple boolean.
- **Storage paths for profile pictures.** The profile record stores the avatar path, and the application converts it into a public Supabase Storage URL when displaying the image.
- **Cover picture reuses the avatar pipeline.** `profiles.cover_picture` stores a storage path just like `profile_picture`, and both uploads go through one shared helper in `upload-profile-picture.ts`. The default cover is a local asset rather than a stored file, so a null column needs no storage object.

## Technical Hurdles

- **Displaying your profile versus another profile.** The screen needs to use the authentication provider for the current user's profile but query Supabase when displaying another user.
- **Profile-picture caching.** Reusing the same storage filename could cause devices to continue showing an older cached image. Uploads use a unique path so the image URL changes when a new picture is saved.

## Feature Workflow

### Viewing your own profile

1. The user opens the Profile tab.
2. The tab passes the authenticated user ID to UserProfile.
3. useProfile recognizes that the ID belongs to the signed-in user and uses the profile already loaded by the authentication provider.
4. The screen loads the user's interests, created activities, joined activities, and completed ride count.
5. The user can switch between Hosted and Attended activities.
6. Selecting an activity opens its activity-detail screen.
7. The user can update their profile picture and interests.
8. Password-reset and logout actions appear at the bottom of the profile.

### Viewing another user

1. The user selects another person's name or avatar.
2. The app opens /profile/[id] using that person's user ID.
3. useProfile retrieves the corresponding profile from Supabase.
4. The screen displays the user's information, interests, completed ride count, and created activities.
5. Owner-only controls are hidden.
6. The action bar displays Follow, Requested, or Following according to the connection state.

### Updating a profile picture

1. The signed-in user presses the edit control on their avatar.
2. The app asks whether they want to use the camera or photo library.
3. The appropriate device permission is requested.
4. The selected image is shown as a preview.
5. The user can cancel or save the image.
6. Saving uploads the image to the avatars bucket and updates the profile_picture field.
7. The previous stored avatar is removed after the new picture is saved.

### Editing profile details

1. The signed-in user opens the profile sidebar and selects Edit Profile.
2. The app pushes the full-screen `/edit-profile` page (step 1, Personal Details) with the current name, university, and major.
3. Next validates the fields and pushes `/edit-profile/driver` (step 2, Driver & Vehicle), passing the step 1 values as route params. Back returns to step 1 with its edits intact.
4. Step 2 loads any saved driver profile and lets the user optionally add vehicle details and verify their license.
5. Save & Complete Profile writes both steps, refreshes the auth provider's profile, and dismisses both pages. Opening step 2 without step 1's values redirects to step 1.

### Updating a cover picture

1. The signed-in user presses the camera control in the top-right corner of their cover.
2. The same camera/photo-library flow runs, cropping to a 3:1 ratio on Android (iOS crops square; the cover is center-cropped to fit).
3. The selected image is previewed in place, with Cancel and Save Cover controls on the cover.
4. Saving uploads the image to the avatars bucket, updates the cover_picture field, removes the previous stored cover, and refreshes the auth provider's profile row.

## Interface Details

- Cover picture: A banner behind the avatar showing the uploaded cover or the default cover. Only the owner sees the edit control.
- Profile avatar: Overlaps the bottom edge of the cover. Displays the uploaded picture or a fallback avatar.
- Profile information: Displays the user's full name, university, and major. Below them, soft-green pills show ".edu Verified" when `is_educational_email` is true and "Verified Driver" when `is_verified_driver` is true (theme tokens `verifiedContainer` / `onVerifiedContainer`).
- Action bar: Shows Edit Profile for the owner. Other users see Follow, Requested, Following, and Message controls depending on connection state.
- Statistics: Displays attended, hosted, rides, and reviews. Completed rides and the combined ride and host review average are loaded from Supabase. Tapping reviews opens the user's [reviews page](reviews.md).
- Interests: Displays selected interests as chips. The profile owner can open a bottom sheet to add or remove interests.
- My Activities: The profile owner can switch between Hosted and Attended activities.
- Recent Activities: Other profiles display activities created by that user.
- Activity cards: Display an image, title, date, and time. Pressing a card opens the activity.
- Account actions: Reset Password and Logout are displayed only on the signed-in user's profile.
- Loading and empty states: The screen displays loading indicators, database-error messages, and messages when no activities are available.

## Relevant Files

| File | Role |
|---|---|
| `app/(tabs)/profile.tsx` | Opens the signed-in user's profile from the tab navigator |
| `app/profile/[id].tsx` | Displays another user's profile through a dynamic route |
| `components/profile/UserProfile.tsx` | Composes the profile screen and loads activities, ride statistics, interests, follow state, and account actions |
| `components/profile/ProfileAvatar.tsx` | Loads, selects, and saves the signed-in user's profile picture |
| `app/edit-profile/index.tsx` | Edit Profile step 1 page: personal details |
| `app/edit-profile/driver.tsx` | Edit Profile step 2 page: driver and vehicle details; saves both steps |
| `components/profile/EditProfileShell.tsx` | Full-screen frame shared by both Edit Profile pages (header, step progress, scroll) |
| `components/profile/EditProfileDriverStep.tsx` | Driver/vehicle form, license verification, and the final save |
| `components/profile/ProfileCover.tsx` | Displays the cover picture and lets the signed-in user select and save a new one |
| `components/profile/ProfileActionBar.tsx` | Displays edit, follow, requested, following, and message actions |
| `components/profile/ProfileInfo.tsx` | Displays the user's name, university, and major |
| `components/profile/ProfileStats.tsx` | Displays profile activity and ride statistics |
| `components/profile/InterestPickerSheet.tsx` | Allows the signed-in user to edit selected interests |
| `components/profile/ActivitySegmentedControl.tsx` | Switches the My Activities section between Hosted and Attended activities |
| `components/profile/MyActivities.tsx` | Renders an activity card in the profile activity list |
| `hooks/use-profile.ts` | Loads either the signed-in profile or another user's profile |
| `hooks/use-profile-interests.ts` | Loads and updates profile-interest relationships |
| `hooks/use-follow.ts` | Manages follow requests, cancellations, and accepted follow state |
| `lib/profile/get-profile-picture.ts` | Resolves the signed-in user's stored avatar path to a public URL |
| `lib/profile/select-profile-image.ts` | Handles camera and photo-library selection with permission checks |
| `lib/profile/upload-profile-picture.ts` | Uploads profile and cover images and updates the profile record |
| `lib/profile/resolve-avatar-uri.ts` | Converts stored avatar paths into displayable URLs with a fallback avatar |
| `lib/profile/resolve-cover-source.ts` | Converts stored cover paths into image sources, falling back to the bundled default cover |
| `supabase/migrations/20261027120000_profile_cover_picture.sql` | Adds the `profiles.cover_picture` column |
