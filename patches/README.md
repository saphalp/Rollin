# Expo Router Startup Fix

After upgrading to SDK 57, Android showed a React warning about updating a component before it mounted. Expo Router was handling the initial link before its navigation container was ready.

`expo-router+57.0.22.patch` makes that callback wait until the container mounts. It also checks whether the navigator has already handled the link.

`npm install` and `npm ci` apply the patch automatically through the `postinstall` script. Expo Router is pinned to 57.0.22 because the patch was written for that version. When updating Expo Router, check whether the fix is still needed and update or remove the patch. Installation will fail if the patch cannot be applied.

Run `node --test scripts/test-router-initial-link.cjs` to check the callback behavior. Also check that the app opens normally on Android after an upgrade.
