# Profiles and Connections

Profiles help students see who they are meeting. A profile shows the person's name, university, major, photos, interests, and activity and ride statistics. Users can follow each other and open a direct chat after the follow is accepted.

## Your profile

Open **Profile** to see your details and switch between hosted and attended activities. Tap an activity to return to its page. The stats include attended activities, hosted activities, rides, and reviews; tapping reviews opens the [reviews page](reviews.md).

Use the profile menu for editing, account settings, password reset, logout, and replaying the tutorial. Only the owner sees controls for changing their profile.

## Editing details and photos

**Edit Profile** starts with name, university, and major, then moves to the driver and vehicle step. Driver registration is optional. The second step can include vehicle details and license verification. Saving updates both steps; going back keeps the first step's edits.

To change an avatar or cover photo, tap its edit control and choose the camera or photo library. The app asks for the needed permission, shows a preview, and lets you save or cancel. Once the new picture is saved, the old stored picture is removed. Profiles without a cover use the bundled default image.

Tap an uploaded avatar to enlarge it. Tap outside it or use Android Back to close it. Interests can be added or removed from the profile's interest picker.

## Other people's profiles

Tap a person's name or avatar to open their profile. Public profiles can be viewed normally; private profiles use the account's access rules and accepted follow relationship.

The follow control changes between **Follow**, **Requested**, and **Following**. A request must be accepted before it counts as a connection. Once allowed, **Message** opens an existing direct chat or creates one.

The educational-email and verified-driver badges show results saved by the backend. The phone does not award those badges by itself.

## How we built it

The app uses one `UserProfile` component for your own profile and other profiles. It changes the available controls based on ownership. Other users open through `/profile/[id]`.

Profile details live in `profiles`, follows in `follows`, and interests in `interests` and `profile_interests`. Profile and cover pictures use the `avatars` storage bucket. The profile saves each file's path, which the app turns into an image URL.

We originally reused the same filename for avatar uploads. Phones kept showing the old cached photo because its address had not changed. Uploads now get a unique path. Cover uploads reuse the same helper and keep their files in the owner's folder.

Profile access is checked through `ProfilePrivacyGate`. A failed check should show an error or limited view rather than displaying profile details by default. Public image URLs already shared outside the app are a separate storage limitation.

## Main files

| File | What it does |
|---|---|
| `components/profile/UserProfile.tsx` | Main profile page |
| `components/profile/ProfilePrivacyGate.tsx` | Checks whether the viewer can open the profile |
| `app/edit-profile/index.tsx`, `app/edit-profile/driver.tsx` | Personal and driver editing steps |
| `components/profile/ProfileAvatar.tsx`, `components/profile/ProfileCover.tsx` | Photo controls |
| `hooks/use-profile.ts` | Loads the profile |
| `hooks/use-profile-interests.ts` | Loads and saves interests |
| `hooks/use-follow.ts` | Follow requests and status |
| `lib/profile/upload-profile-picture.ts` | Uploads pictures and saves their paths |

The cover-picture column is added by `supabase/migrations/20261027120000_profile_cover_picture.sql`. When testing profile changes, check your own profile, someone else's public profile, and a private profile before and after an accepted follow.
