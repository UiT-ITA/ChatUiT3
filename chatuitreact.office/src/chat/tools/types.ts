/* global AbortSignal */

/** Arguments as parsed from the model's JSON. Handlers validate what they read. */
export type ToolArguments = Record<string, unknown>;

/** A picture a tool returns, base64 without a data: prefix. */
export interface ToolImage {
  mediaType: "image/png" | "image/jpeg";
  base64: string;
}

/** A tool result with pictures: the model gets `value` as JSON text and the images as pictures. */
export class ToolResultWithImages {
  constructor(
    readonly value: unknown,
    readonly images: readonly ToolImage[]
  ) {}
}

/**
 * A function tool that runs in the add-in. Its JSON-serialisable result is sent back to the model;
 * a handler that returns ToolResultWithImages sends pictures too.
 */
export interface ClientToolDefinition {
  name: string;
  description: string;
  /** JSON Schema of the arguments object. */
  parameters: Record<string, unknown>;
  handler(args: ToolArguments, signal: AbortSignal): Promise<unknown>;
}
