/* global AbortController */

import { describeError } from "../../chat/conversation/conversation";
import type { ToolArguments } from "../../chat/tools/types";
import { isSetSupported, type OfficeToolDefinition } from "./officeTool";

/** A read tool's result, as it would return it to the model, or null when this version of the app lacks the tool. */
export async function readWith(tool: OfficeToolDefinition, args: ToolArguments = {}): Promise<unknown> {
  if (tool.requires && !isSetSupported(tool.requires)) {
    return null;
  }
  return tool.handler(args, new AbortController().signal);
}

/**
 * The app's context: one labelled JSON part per read, in order. A read that fails is reported in its part and
 * leaves the others in place; a read that returns null is left out.
 */
export async function joinContext(app: string, parts: Array<[label: string, read: () => Promise<unknown>]>) {
  const lines = [app];
  for (const [label, read] of parts) {
    try {
      const value = await read();
      if (value !== null && value !== undefined) {
        lines.push(`${label}: ${JSON.stringify(value)}`);
      }
    } catch (error) {
      lines.push(`${label}: could not be read (${describeError(error)})`);
    }
  }
  return lines.join("\n");
}
