# Getting Started

You can try Rollin on an Android phone through Google Play. If you want to work on the app, the development setup is below.

## Try the app

Rollin has a demo/test build on Google Play. Open the [Rollin Play Store link](https://play.google.com/store/apps/details?id=com.rollin.app) on your Android phone. The app's package name is `com.rollin.app`.

If the page is unavailable or you cannot install it, contact the team for testing access and the current installation link. Access may depend on which Google account you use and how the test release is set up.

After installing:

1. Open Rollin and create an account, or sign in if you already have one.
2. For email signup, enter the code sent to your inbox. If login verification is enabled, a fresh login also asks for a login code.
3. Complete your profile if you are new to the app.
4. Follow the tutorial or skip it and explore. You can replay it later from the profile menu.

You do not need Node.js, Expo Go, or the source code to use the Play Store build.

## Work on the app

You will need Git, Node.js and npm, a code editor, and an Android phone or emulator. Ask a teammate for the project settings and access needed for your task.

The project currently uses Expo SDK 58, React Native, and TypeScript. Use the versions in `package.json` and `package-lock.json` when setting up your copy.

### Get the code

Start from `dev`, where we combine and test changes. `main` is for production.

```powershell
git clone --branch dev https://github.com/saphalp/Rollin.git
cd Rollin
npm ci
git switch -c your-feature-name
```

If you already have the project, keep your local changes safe before switching branches or pulling. See [Development Workflow](development-workflow.md).

### Add the project settings

Create `.env.local` in the project folder:

```text
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
EXPO_PUBLIC_GOOGLE_PLACES_API_KEY=
```

Ask a teammate for the values. The Supabase settings connect the app to our backend. The Google Places key is used for address suggestions. Keep the file local; it is ignored by Git.

Values beginning with `EXPO_PUBLIC_` are included in the app. Never put a Supabase service-role key, Resend key, or another server secret there. Those belong in Supabase's server settings.

### Run your changes on Android

For full feature testing, use a development build made for this project. Ask the team for the current build, or build it locally if you have Android Studio and the Android SDK set up:

```powershell
npx expo run:android
```

Once the development build is installed, start the server with:

```powershell
npx expo start --dev-client
```

Open the project in that development build. Keep the terminal running while you test. The Play Store demo is a separate installed build; it does not load your local edits from this server.

For a quick check in a compatible version of Expo Go, use:

```powershell
npx expo start --go
```

If your phone cannot reach the computer over Wi-Fi, try:

```powershell
npx expo start --go --tunnel
```

If scanning the QR code opens a browser error, copy the current `exp://...` address shown beside **Metro** into Expo Go's URL field. The address changes between sessions, so use the one from the running terminal.

Expo Go cannot test every feature. Remote push notifications on Android and features that need extra native modules require a development or installed app build. See [Expo's CLI guide](https://docs.expo.dev/more/expo-cli/) for the available startup options.

### Database changes

Most day-to-day work uses the shared Supabase project. Pulling code does not apply SQL files or deploy Edge Functions. If your feature needs one of those changes, read its setup page and check with the team before applying it to the shared project.
