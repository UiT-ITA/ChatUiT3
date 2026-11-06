import type { PaneTheme } from "../chat/ui/tokens";

/** The pane's theme for a Teams theme name: "default" is light, "dark" and "contrast" are dark. */
export function paneTheme(teamsTheme: string | undefined): PaneTheme {
  return { mode: teamsTheme === "dark" || teamsTheme === "contrast" ? "dark" : "light", background: null };
}
