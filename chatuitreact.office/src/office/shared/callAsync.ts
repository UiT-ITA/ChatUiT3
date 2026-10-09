/* global Office */

/**
 * Runs an Office callback API (one that reports an Office.AsyncResult) as a promise. A failed call
 * rejects with Office's error name, code and message.
 */
export function callAsync<T>(start: (callback: (result: Office.AsyncResult<T>) => void) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    start((result) => {
      if (result.status === Office.AsyncResultStatus.Succeeded) {
        resolve(result.value);
      } else {
        reject(new Error(`${result.error.name} (${result.error.code}): ${result.error.message}`));
      }
    });
  });
}
