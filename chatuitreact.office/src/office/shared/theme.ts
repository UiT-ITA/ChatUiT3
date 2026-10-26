/* global Office, window */

import type { PaneTheme, ThemeMode } from "../../chat/ui/tokens";

const DARK_SCHEME = "(prefers-color-scheme: dark)";

/** Office's theme: dark for the Black and Dark Gray themes, with Office's body colour as the pane background. */
export function readOfficeTheme(): PaneTheme {
  const theme = Office.context.officeTheme as Office.OfficeTheme | undefined;
  if (!theme?.bodyBackgroundColor) {
    return { mode: "light", background: null };
  }
  // Outlook has no isDarkTheme, so the background's brightness decides there.
  const dark = typeof theme.isDarkTheme === "boolean" ? theme.isDarkTheme : isDarkColor(theme.bodyBackgroundColor);
  return { mode: dark ? "dark" : "light", background: theme.bodyBackgroundColor };
}

/**
 * Calls `onChange` with the pane's theme when it changes: when the system switches between light and dark (Word on
 * Mac follows it without updating Office's theme), and on Outlook's theme event.
 */
export function watchOfficeTheme(onChange: (theme: PaneTheme) => void): void {
  const scheme = window.matchMedia(DARK_SCHEME);
  scheme.addEventListener("change", () => onChange(themeFor(scheme.matches ? "dark" : "light")));
  if (Office.context.mailbox && Office.context.requirements.isSetSupported("Mailbox", "1.14")) {
    Office.context.mailbox.addHandlerAsync(Office.EventType.OfficeThemeChanged, () => onChange(readOfficeTheme()));
  }
}

/** The theme for a mode, with Office's background when Office's theme has that mode too. */
function themeFor(mode: ThemeMode): PaneTheme {
  const office = readOfficeTheme();
  return office.mode === mode ? office : { mode, background: null };
}

/** True when a "#RRGGBB" colour is darker than mid grey. */
function isDarkColor(hex: string): boolean {
  const match = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  if (!match) {
    return false;
  }
  const [r, g, b] = match.slice(1).map((part) => parseInt(part, 16));
  return 0.299 * r + 0.587 * g + 0.114 * b < 128;
}
