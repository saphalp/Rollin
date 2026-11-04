# Design and Shared Components

Rollin uses blue for its main actions, rounded cards, and consistent spacing. Screens should feel like parts of the same app, and the next action should be easy to find.

Use the shared colors in `constants/theme.ts` instead of adding a new color to each screen. Check both light and dark mode when changing a component.

## Colors

These are some of the main light-theme colors. The theme file is the source to check when they change.

| Use | Color |
|---|---|
| Main blue | `#0058be` |
| Blue background for main controls | `#2170e4` |
| Page background | `#f0f3fa` |
| Card background | `#f9f9ff` |
| Main text | `#191b23` |
| Supporting text and icons | `#424754` |
| Amber background | `#fea619` |
| Amber text | `#855300` |
| Error text | `#ba1a1a` |

## Layout and text

Keep related controls together and leave enough space to tap them. Pages should fit around the status bar, camera cutout, and bottom navigation. Forms need to stay usable when the keyboard opens.

Buttons must show their full labels. Do not cut **Next** or **Back** down to an ellipsis. Check larger phone text settings as well as the default size. Loading, empty, and error messages should say what is happening and give the user a useful next step.

## Back buttons

Use `BackButton` from `components/ui/back-button.tsx`. It shows the shared blue chevron and goes back to the previous page. If there is no page to return to, it uses `fallbackHref`, which defaults to the main tabs.

- In a custom header, render `<BackButton />`. Pass `onPress` if the screen needs its own back action.
- In a Stack header, set `headerBackVisible: false` and use `headerLeft: () => <BackButton />`.
- Over a photo or map, use `variant="floating"` so the button has a readable background.
- Use `BACK_BUTTON_SIZE` for the spacer on the other side when centering a header title.
