/* global Office */

import { requireOneOf, requireString } from "../../../chat/tools/args";
import { callAsync } from "../../shared/callAsync";
import type { OfficeToolDefinition } from "../../shared/officeTool";
import { markdownToHtml, markdownToText } from "../markdownToHtml";
import { composeItem } from "./shared";

const NAME = "outlook_set_body";
const MODES = ["replace", "insertAtCursor", "prepend"] as const;

export const setBody: OfficeToolDefinition = {
  name: NAME,
  description:
    "Write Markdown into the body of the draft being composed: replace the whole body, insert at the cursor " +
    "(replacing any selected text) or prepend at the start. Markdown becomes HTML, or plain text when the body " +
    "is plain text.",
  parameters: {
    type: "object",
    properties: {
      mode: { type: "string", enum: [...MODES] },
      markdown: { type: "string" },
    },
    required: ["mode", "markdown"],
    additionalProperties: false,
  },
  handler: async (args, signal) => {
    const mode = requireOneOf(args, "mode", MODES);
    const markdown = requireString(args, "markdown");
    const { body } = composeItem(signal, NAME).item;

    const type = await callAsync<Office.CoercionType>((callback) => body.getTypeAsync(callback));
    const html = type === Office.CoercionType.Html;
    const data = html ? markdownToHtml(markdown) : markdownToText(markdown);
    const options = { coercionType: html ? Office.CoercionType.Html : Office.CoercionType.Text };
    switch (mode) {
      case "replace":
        await callAsync<void>((callback) => body.setAsync(data, options, callback));
        break;
      case "insertAtCursor":
        await callAsync<void>((callback) => body.setSelectedDataAsync(data, options, callback));
        break;
      case "prepend":
        await callAsync<void>((callback) => body.prependAsync(data, options, callback));
        break;
    }
    return { mode, format: html ? "html" : "text" };
  },
};
