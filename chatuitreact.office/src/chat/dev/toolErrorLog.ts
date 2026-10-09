/* global fetch, navigator, URL, window */

import type { ToolFailure } from "../conversation/conversation";

/** The plugin dev server's endpoint, which appends each entry to logs/tool-errors.jsonl (webpack.config.js). */
const ENDPOINT = "/dev/tool-errors";

/** Development builds only: sends a failed tool call to the plugin dev server's log. */
export function logToolError(failure: ToolFailure, server: string): void {
  let args: unknown = failure.arguments;
  try {
    args = JSON.parse(failure.arguments);
  } catch {
    // Kept as the raw text the model sent.
  }
  const entry = {
    time: new Date().toISOString(),
    server,
    tool: failure.name,
    arguments: args,
    error: failure.error,
    userAgent: navigator.userAgent,
  };
  fetch(new URL(ENDPOINT, window.location.origin), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(entry),
  }).catch(() => {
    // Logging must never break the chat.
  });
}
