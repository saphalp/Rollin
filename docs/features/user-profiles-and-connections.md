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
- Follow requests must be accepted before the users are considered connected.
- Direct-message conversations are created through the get_or_create_direct_conversation Supabase function.

## Decisions

- **One shared profile component.** UserProfile is used for both the signed-in user and other users. The component changes its controls depending on whether the displayed profile belongs to the current user.
- **Dynamic routes for other profiles.** Other users are opened through /profile/[id], which allows the same route to display any profile by its user ID.
- **Three follow states.** A connection can be not_following, requested, or following. These states make it possible to represent pending requests instead of treating following as a simple boolean.
- **Storage paths for profile pictures.** The profile record stores the avatar path, and the application converts it into a public Supabase Storage URL when displaying the image.

## Technical Hurdles

- **Displaying your profile versus another profile.** The screen needs to use the authentication provider for the current user's profile but query Supabase when displaying another user.
- **Profile-picture caching.** Reusing the same storage filename could cause devices to continue showing an older cached image. Uploads use a unique path so the image URL changes when a new picture is saved.

## Feature Workflow

### Viewing your own profile

1. The user opens the Profile tab.
2. The tab passes the authenticated user ID to UserProfile.
3. useProfile recognizes that the ID belongs to the signed-in user and uses the profile already loaded by the authentication provider.
4. The screen loads the user's interests, created activities, joined activities, and completed ride count.
5. The user can switch between Created and Joined activities.
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

## Interface Details

- Profile avatar: Displays the uploaded picture or a fallback avatar. An educational verification badge appears when is_educational_email is true.
- Profile information: Displays the user's full name, university, and major.
- Action bar: Shows Edit Profile for the owner. Other users see Follow, Requested, Following, and Message controls depending on connection state.
- Statistics: Displays attended, hosted, rides, and rating. Currently, only completed rides are dynamically calculated.
- Interests: Displays selected interests as chips. The profile owner can open a bottom sheet to add or remove interests.
- My Activities: The profile owner can switch between Created and Joined activities.
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
| `components/profile/ProfileActionBar.tsx` | Displays edit, follow, requested, following, and message actions |
| `components/profile/ProfileInfo.tsx` | Displays the user's name, university, and major |
| `components/profile/ProfileStats.tsx` | Displays profile activity and ride statistics |
| `components/profile/InterestPickerSheet.tsx` | Allows the signed-in user to edit selected interests |
| `components/profile/ActivitySegmentedControl.tsx` | Switches the My Activities section between Created and Joined activities |
| `components/profile/MyActivities.tsx` | Renders an activity card in the profile activity list |
| `hooks/use-profile.ts` | Loads either the signed-in profile or another user's profile |
| `hooks/use-profile-interests.ts` | Loads and updates profile-interest relationships |
| `hooks/use-follow.ts` | Manages follow requests, cancellations, and accepted follow state |
| `lib/profile/get-profile-picture.ts` | Resolves the signed-in user's stored avatar path to a public URL |
| `lib/profile/select-profile-image.ts` | Handles camera and photo-library selection with permission checks |
| `lib/profile/upload-profile-picture.ts` | Uploads profile images and updates the profile record |
| `lib/profile/resolve-avatar-uri.ts` | Converts stored avatar paths into displayable URLs with a fallback avatar |
