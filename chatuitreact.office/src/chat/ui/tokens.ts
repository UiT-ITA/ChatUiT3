import type { GriffelStyle } from "@fluentui/react-components";

/**
 * The ChatUiT app's design tokens (UiT profile, blue light theme), so the plugin looks like the app.
 * Source: chatuitreact.client/src/styles/tokens.css, theme.css and typography.css.
 */

export const color = {
  bg: "#FFFFFF",
  surface: "#FFFFFF",
  panel: "#f2f5f6",
  panel2: "#e6eaed",
  text: "#003349",
  text2: "#3f4c53",
  text3: "#6a767c",
  line: "#d7dcde",
  lineSoft: "#ebeeef",
  brand: "#003349",
  accent: "#007396",
  accent2: "#59BEC9",
  btnBg: "#003349",
  btnFg: "#FFFFFF",
  btnHover: "#002536",
  codeBg: "#f6f7f8",
  warn: "#F2A900",
  danger: "#CB333B",
  success: "#2e7d5b",
} as const;

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

export const radius = { sm: "2px", md: "4px", lg: "8px" } as const;

export const shadowCard = "0 1px 2px rgba(0, 51, 73, .08), 0 2px 8px rgba(0, 51, 73, .10)";

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
