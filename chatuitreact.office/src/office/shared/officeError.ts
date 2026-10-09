/* global OfficeExtension */

/** Extra text for an Office error code, saying what the code means in one app. */
export type ErrorHints = Readonly<Partial<Record<string, string>>>;

/** What error codes mean in every app. An app's own hints come first. */
const commonHints: ErrorHints = {
  PropertyNotLoaded:
    "a property was read before it was loaded: call object.load('name1,name2') for everything you will read, " +
    "then await context.sync() once, then read the values",
};

/** The error code, message, failing call and statement, so the model and the user see exactly what Office rejected. */
export function describeOfficeError(error: OfficeExtension.Error, hints: ErrorHints = {}): string {
  const info = error.debugInfo;
  const parts = [`${error.code}: ${error.message}`];
  if (info?.errorLocation) {
    parts.push(`failing call: ${info.errorLocation}`);
  }
  if (info?.statement) {
    parts.push(`statement: ${info.statement}`);
  }
  const hint = hints[error.code] ?? commonHints[error.code];
  if (hint) {
    parts.push(hint);
  }
  return parts.join("; ");
}
