import type { ClientToolDefinition } from "../clientToolRegistry";

/** Demo client tool: the user's local clock, which the server cannot know. */
export const getClientTimeTool: ClientToolDefinition<Record<string, never>> = {
  name: "client_get_time",
  description: "Get the current date and time on the user's device, including their time zone and locale. Use it when the user asks what time it is or refers to 'now', 'today' or 'tomorrow'.",
  parameters: { type: "object", properties: {}, additionalProperties: false },
  async handler() {
    const now = new Date();
    return JSON.stringify({
      iso: now.toISOString(),
      local: now.toString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      utcOffsetMinutes: -now.getTimezoneOffset(),
      locale: navigator.language,
    });
  },
};
