import type { GriffelStyle } from "@fluentui/react-components";

/**
 * The ChatUiT app's design tokens (UiT profile, blue theme), so the plugin looks like the app.
 * Source: ChatUiT.Client/src/styles/tokens.css, theme.css and typography.css.
 */

export type ThemeMode = "light" | "dark";

/** The pane's theme: light or dark as Office is, and Office's own pane background when Office reports it. */
export interface PaneTheme {
  mode: ThemeMode;
  /** A CSS colour, or null for the palette's own background. */
  background: string | null;
}

const light = {
  bg: "#FFFFFF",
  surface: "#FFFFFF",
  panel: "#f2f5f6",
  panel2: "#e6eaed",
  bubble: "#edf1f3",
  text: "#003349",
  text2: "#3f4c53",
  text3: "#5f6b71",
  line: "#d7dcde",
  lineSoft: "#ebeeef",
  brand: "#003349",
  accent: "#007396",
  accent2: "#59BEC9",
  btnBg: "#003349",
  btnFg: "#FFFFFF",
  btnHover: "#002536",
  codeBg: "#f6f7f8",
  selBg: "#59BEC9",
  selFg: "#003349",
  warn: "#F2A900",
  danger: "#CB333B",
  success: "#2e7d5b",
};

export type Palette = typeof light;

/** Light blue on Office's dark grey, as the app's blue dark theme. */
const dark: Palette = {
  bg: "#262626",
  surface: "#2e2e2e",
  panel: "#333333",
  panel2: "#3a3a3a",
  bubble: "#33393c",
  text: "#e9eef0",
  text2: "#b7c2c7",
  text3: "#929da2",
  line: "#424242",
  lineSoft: "#363636",
  brand: "#59BEC9",
  accent: "#7acbd4",
  accent2: "#59BEC9",
  btnBg: "#59BEC9",
  btnFg: "#003349",
  btnHover: "#7acbd4",
  codeBg: "#1f1f1f",
  selBg: "#59BEC9",
  selFg: "#003349",
  warn: "#F2C14E",
  danger: "#e08589",
  success: "#5cb893",
};

export const palettes: Record<ThemeMode, Palette> = { light, dark };

/** Every colour as a CSS variable, set on the page by `paletteVariables`, so styles follow the theme. */
export const color = Object.fromEntries(Object.keys(light).map((name) => [name, `var(--chatuit-${name})`])) as Record<
  keyof Palette,
  string
>;

/** The CSS variables of a theme, for the page's root element. */
export function paletteVariables(theme: PaneTheme): Record<string, string> {
  const palette = { ...palettes[theme.mode], ...(theme.background ? { bg: theme.background } : {}) };
  return Object.fromEntries(Object.entries(palette).map(([name, value]) => [`--chatuit-${name}`, value]));
}

export const font = {
  sans: '"Open Sans", "Segoe UI", Arial, Helvetica, sans-serif',
  mono: '"IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
} as const;

export const fontSize = {
  overline: "0.6875rem",
  caption: "0.75rem",
  code: "0.7813rem",
  ui: "0.8125rem",
  table: "0.8438rem",
  bodySm: "0.875rem",
  chat: "0.9063rem",
  titleSm: "0.9375rem",
  h3: "1.0625rem",
  h2: "1.1875rem",
  h1: "1.375rem",
} as const;

export const radius = { sm: "6px", md: "8px", lg: "12px", pill: "999px" } as const;

/** The app's text roles. Every text uses exactly one. */
export const typography = {
  title: { fontSize: fontSize.titleSm, fontWeight: 700 },
  chat: { fontSize: fontSize.chat, lineHeight: 1.6 },
  ui: { fontSize: fontSize.ui, fontWeight: 600 },
  uiPlain: { fontSize: fontSize.ui, fontWeight: 400 },
  caption: { fontSize: fontSize.caption, fontWeight: 400 },
  captionStrong: { fontSize: fontSize.caption, fontWeight: 600 },
  overline: { fontSize: fontSize.overline, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" },
  meta: { fontFamily: font.mono, fontSize: fontSize.overline, fontWeight: 400 },
  code: { fontFamily: font.mono, fontSize: fontSize.code, lineHeight: 1.6 },
} satisfies Record<string, GriffelStyle>;
