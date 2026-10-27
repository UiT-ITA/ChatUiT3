/* global AbortSignal, OfficeExtension */

import { describeOfficeError, type ErrorHints } from "./officeError";

/**
 * Runs an Office batch (Word.run, Excel.run, PowerPoint.run) unless the call was cancelled. Office
 * errors are rethrown with their debug info and the app's hints.
 */
export async function runBatch<T>(signal: AbortSignal, run: () => Promise<T>, hints?: ErrorHints): Promise<T> {
  if (signal.aborted) {
    throw new Error("Cancelled.");
  }
  try {
    return await run();
  } catch (error) {
    if (error instanceof OfficeExtension.Error) {
      throw new Error(describeOfficeError(error, hints), { cause: error });
    }
    throw error;
  }
}
