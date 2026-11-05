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
  sel: "#e6f1f5",
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
  codeBg: "#f1f4f6",
  selBg: "#59BEC9",
  selFg: "#003349",
  warn: "#F2A900",
  danger: "#CB333B",
  success: "#2e7d5b",
  shadowColor: "#003349",
};

export type Palette = typeof light;

/** Light blue on dark blue, as the app's blue dark theme. */
const dark: Palette = {
  bg: "#00202e",
  surface: "#002230",
  panel: "#001926",
  panel2: "#003247",
  sel: "#0b4259",
  text: "#e9eef0",
  text2: "#a8bcc4",
  text3: "#92a8b1",
  line: "#1f5a72",
  lineSoft: "#134458",
  brand: "#59BEC9",
  accent: "#7acbd4",
  accent2: "#59BEC9",
  btnBg: "#59BEC9",
  btnFg: "#003349",
  btnHover: "#7acbd4",
  codeBg: "#00151f",
  selBg: "#59BEC9",
  selFg: "#003349",
  warn: "#f7cb66",
  danger: "#e08589",
  success: "#5cb893",
  shadowColor: "#000000",
};

export const palettes: Record<ThemeMode, Palette> = { light, dark };

/** Every colour as a CSS variable, set on the page by `paletteVariables`, so styles follow the theme. */
export const color = Object.fromEntries(Object.keys(light).map((name) => [name, `var(--chatuit-${name})`])) as Record<
  keyof Palette,
  string
>;

/** Shadow strength per mode, in percent of the shadow colour: card near, card far, overlay. */
const shadowStrength: Record<ThemeMode, [number, number, number]> = { light: [8, 10, 22], dark: [25, 30, 50] };

/** The CSS variables of a theme, for the page's root element: the colours and the shadows. */
export function paletteVariables(theme: PaneTheme): Record<string, string> {
  const palette = { ...palettes[theme.mode], ...(theme.background ? { bg: theme.background } : {}) };
  const [near, far, overlay] = shadowStrength[theme.mode];
  const mix = (percent: number) => `color-mix(in srgb, ${color.shadowColor} ${percent}%, transparent)`;
  return {
    ...Object.fromEntries(Object.entries(palette).map(([name, value]) => [`--chatuit-${name}`, value])),
    "--chatuit-shadow-card": `0 1px 2px ${mix(near)}, 0 2px 8px ${mix(far)}`,
    "--chatuit-shadow-overlay": `0 8px 40px ${mix(overlay)}`,
  };
}

export const font = {
  sans: '"Open Sans", "Segoe UI", Arial, Helvetica, sans-serif',
  serif: '"Source Serif 4", "Minion Pro", "Times New Roman", Times, serif',
  mono: '"IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
} as const;

/** The same fixed scale as ChatUiT.Client/src/styles/tokens.css, with the same values. */
export const space = {
  xs: "0.25rem",
  sm: "0.5rem",
  md: "0.75rem",
  lg: "1rem",
  xl: "1.5rem",
  "2xl": "2rem",
  "3xl": "4rem",
} as const;

export const fs = {
  xs: "0.75rem",
  sm: "0.8125rem",
  md: "0.9375rem",
  lg: "1.125rem",
  xl: "1.375rem",
  "2xl": "1.75rem",
} as const;

export const fw = { regular: 400, medium: 500, bold: 600 } as const;

export const lh = { tight: 1.25, base: 1.5 } as const;

export const radius = { sm: "0.125rem", md: "0.25rem", lg: "0.5rem", pill: "999rem" } as const;

export const border = { sm: "1px", md: "2px", lg: "3px" } as const;

/** Set per mode by `paletteVariables`. */
export const shadow = { card: "var(--chatuit-shadow-card)", overlay: "var(--chatuit-shadow-overlay)" } as const;

export const dur = { fast: "120ms", base: "180ms", slow: "320ms", loop: "1s" } as const;

export const opacity = { muted: 0.6, disabled: 0.45 } as const;

export const z = { sticky: 10, overlay: 1000, dropdown: 1100, toast: 1200 } as const;

export const control = { sm: "1.75rem", md: "2.25rem", lg: "2.75rem" } as const;

export const icon = { sm: "1rem", md: "1.25rem", lg: "1.5rem" } as const;

export const size = {
  "3xs": "5rem",
  "2xs": "10rem",
  xs: "16rem",
  sm: "20rem",
  md: "32rem",
  lg: "48rem",
  xl: "72rem",
} as const;

export const layout = { pageMaxWidth: "51.25rem", contextColumnWidth: "17.125rem", railWidth: "3.75rem" } as const;

/** The app's text roles. Every text uses exactly one. */
export const typography = {
  title: { fontSize: fs.md, fontWeight: fw.bold },
  chat: { fontSize: fs.md, lineHeight: lh.base },
  ui: { fontSize: fs.sm, fontWeight: fw.bold },
  uiPlain: { fontSize: fs.md, fontWeight: fw.regular },
  caption: { fontSize: fs.sm, fontWeight: fw.regular, lineHeight: lh.base },
  captionStrong: { fontSize: fs.sm, fontWeight: fw.bold },
  overline: { fontSize: fs.xs, fontWeight: fw.bold, letterSpacing: "0.08em", textTransform: "uppercase" },
  meta: { fontSize: fs.sm, fontWeight: fw.regular, fontVariantNumeric: "tabular-nums" },
  code: { fontFamily: font.mono, fontSize: fs.sm, lineHeight: lh.base },
} satisfies Record<string, GriffelStyle>;
