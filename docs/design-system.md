# Design System

## Design Goals

Rollin’s interface is intended to appeal to modern-day college students.

The interface should:

- Use consistent colors and spacing
- Make actions easy to identify
- Provide clear states
- Reuse existing components before introducing new visual patterns
- Remain usable with different screen sizes

## Color Palette

The shared color definitions are stored in `constants/theme.ts`.

Primary colors include:

| Purpose | Color |
|---|---|
| Primary electric blue | `#0058be` |
| Primary container blue | `#2170e4` |
| Main background | `#f0f3fa` |
| Surface | `#f9f9ff` |
| Primary text | `#191b23` |
| Secondary text and icons | `#424754` |
| Warm amber background | `#fea619` |
| Warm amber text | `#855300` |
| Error | `#ba1a1a` |
| Verified badge | `#10B981` |

## Layout and Spacing

Screens generally use:

- Safe-area padding
- Consistent horizontal margins
- Rounded cards
- Grouped sections
- Clear separation between primary and supporting information
- Scrollable layouts for content that may exceed screen height

Forms should remain scrollable while the keyboard is open.


## Back Navigation

Every screen uses the shared `BackButton` (`components/ui/back-button.tsx`): a blue (`tint`) chevron with no text label. Don't hand-roll a back button or rely on the native header's default back button.

- Custom headers render `<BackButton />`. By default it goes back, or replaces to `fallbackHref` (default `/(tabs)`) when there is no history; pass `onPress` to run your own back logic.
- Native Stack headers set `headerBackVisible: false` and `headerLeft: () => <BackButton />` so iOS doesn't show a "Back" label and Android doesn't show its arrow.
- Over photos or maps, use `variant="floating"` for a round card background that stays readable on the image.
- To center a header title, size the empty spacer on the right with `BACK_BUTTON_SIZE`.
