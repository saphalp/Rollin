# Patches

`npm install` and `npm ci` run `patch-package --error-on-fail` as a `postinstall` step, applying any `<package>+<version>.patch` file in this folder to `node_modules`.

There are currently no patches.

## History

- `expo-router+57.0.22.patch` (removed with the Expo SDK 58 upgrade). On SDK 57, Android logged a React warning about updating a component before it mounted, because Expo Router handled the initial link before its navigation container was ready. The patch deferred that update until mount. Expo Router 58 rewrote this: the initial navigation state is resolved through Suspense before the container mounts, and the unhandled-link state the patch guarded no longer exists, so the patch no longer applies and isn't needed.

## Adding a patch

A patch only applies to the exact version in its filename. When you upgrade a patched package, update or remove the patch in the same change, or every `npm install` will fail at `postinstall`.
