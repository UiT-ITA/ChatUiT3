/* global AbortSignal */

import { describeError } from "../../chat/conversation/conversation";
import { requireString } from "../../chat/tools/args";
import type { OfficeToolDefinition } from "./officeTool";

const MAX_RESULT_LENGTH = 20_000;

/** Every app's scripts fail the same way when they read a property they did not load. */
const READ_PATTERN =
  "To read anything, load it first and sync once: `const item = ...; item.load('name,size'); await context.sync(); " +
  "return { name: item.name, size: item.size };`. Reading a property that was not loaded fails with PropertyNotLoaded.";

export interface RunScriptOptions<Context> {
  name: string;
  description: string;
  /** The name the code uses for the app's API, such as "Excel". */
  apiName: string;
  /** The app's API namespace. Read when the tool runs, after office.js has loaded. */
  api(): unknown;
  /** Runs a batch in the app, such as `(signal, batch) => runBatch(signal, () => Excel.run(batch))`. */
  run(signal: AbortSignal, batch: (context: Context) => Promise<unknown>): Promise<unknown>;
}

type Script<Context> = (context: Context, api: unknown) => Promise<unknown>;

/**
 * A tool that runs Office.js code the model writes. code is the body of `async (context, <apiName>) => { ... }`
 * and runs inside the app's batch. Its JSON result is cut to MAX_RESULT_LENGTH characters.
 */
export function createRunScriptTool<Context>(options: RunScriptOptions<Context>): OfficeToolDefinition {
  return {
    name: options.name,
    description: `${options.description} ${READ_PATTERN}`,
    parameters: {
      type: "object",
      properties: { code: { type: "string" } },
      required: ["code"],
      additionalProperties: false,
    },
    handler: async (args, signal) => {
      const code = requireString(args, "code");
      let script: Script<Context>;
      try {
        // Running model-written code is the purpose of this tool. The async body is not transpiled.
        script = new Function("context", options.apiName, `return (async () => {\n${code}\n})();`) as Script<Context>;
      } catch (error) {
        throw new Error(`The code does not compile: ${describeError(error)}`);
      }
      const value = (await options.run(signal, (context) => script(context, options.api()))) ?? null;
      const json = JSON.stringify(value);
      return json.length > MAX_RESULT_LENGTH
        ? { result: json.slice(0, MAX_RESULT_LENGTH), truncated: true }
        : { result: value };
    },
  };
}
