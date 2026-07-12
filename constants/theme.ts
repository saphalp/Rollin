import { Platform } from "react-native";

const tintColorLight = "#0058be"; // primary (Electric Blue)
const tintColorDark = "#adc6ff"; // inverse-primary

export const Colors = {
  light: {
    text: "#191b23", // on-surface
    background: "#f9f9ff", // surface / background
    tint: tintColorLight,
    icon: "#424754", // on-surface-variant
    tabIconDefault: "#727785", // outline
    tabIconSelected: tintColorLight,
    // Extras from the design system, handy for cards/buttons/badges
    surface: "#f9f9ff",
    surfaceContainer: "#ecedf7",
    surfaceContainerHigh: "#e6e7f2",
    onPrimary: "#ffffff",
    primaryContainer: "#2170e4",
    secondary: "#855300", // Warm Amber (on-secondary text)
    secondaryContainer: "#fea619", // Warm Amber background
    onSecondaryContainer: "#684000",
    error: "#ba1a1a",
    onError: "#ffffff",
    errorContainer: "#ffdad6",
    outline: "#727785",
    outlineVariant: "#c2c6d6",
    verified: "#10B981", // Emerald verified badge
    cardBackground: "#ffffff", // card surface on top of background
    onImageOverlay: "#ffffff", // text/icons on dark photo overlays
  },
  dark: {
    text: "#191b23", // on-surface
    background: "#f9f9ff", // surface / background
    tint: tintColorLight,
    icon: "#424754", // on-surface-variant
    tabIconDefault: "#727785", // outline
    tabIconSelected: tintColorLight,
    // Extras from the design system, handy for cards/buttons/badges
    surface: "#f9f9ff",
    surfaceContainer: "#ecedf7",
    surfaceContainerHigh: "#e6e7f2",
    onPrimary: "#ffffff",
    primaryContainer: "#2170e4",
    secondary: "#855300", // Warm Amber (on-secondary text)
    secondaryContainer: "#fea619", // Warm Amber background
    onSecondaryContainer: "#684000",
    error: "#ba1a1a",
    onError: "#ffffff",
    errorContainer: "#ffdad6",
    outline: "#727785",
    outlineVariant: "#c2c6d6",
    verified: "#10B981", // Emerald verified badge
    cardBackground: "#ffffff", // card surface on top of background
    onImageOverlay: "#ffffff", // always white on dark photo overlays
  },
};

export const LandingGradient = [
  "#c8e8ff",
  "#3d9de0",
  "#0058be",
  "#040c1e",
] as const;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: "Nunito Sans",
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: "ui-serif",
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: "ui-rounded",
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: "ui-monospace",
  },
  default: {
    sans: "Nunito Sans",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "'Nunito Sans', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded:
      "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
