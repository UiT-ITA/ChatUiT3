/* global clearTimeout, Office, setTimeout, URL, window */

import type { DialogAuthMessage, DialogToken } from "../../chat/auth/msalAuth";

/** The sign-in dialog is closed when it has not answered after this many milliseconds. */
const DIALOG_TIMEOUT_MS = 5 * 60 * 1000;

/** The dialog event Office sends when the user closes the dialog. */
const DIALOG_CLOSED_BY_USER = 12006;

/** Opens authdialog.html in an Office dialog and resolves with the token it sends. */
export function openOfficeSignInDialog(scopes: string[], loginHint: string | undefined): Promise<DialogToken> {
  const url = new URL("authdialog.html", window.location.href);
  for (const scope of scopes) {
    url.searchParams.append("scope", scope);
  }
  if (loginHint) {
    url.searchParams.set("loginHint", loginHint);
  }
  return new Promise((resolve, reject) => {
    Office.context.ui.displayDialogAsync(url.href, { height: 60, width: 30 }, (result) => {
      if (result.status === Office.AsyncResultStatus.Failed) {
        reject(new Error(`The sign-in dialog could not open (${result.error.code}: ${result.error.message})`));
        return;
      }
      const dialog = result.value;
      /** Stops the timeout and closes the dialog when it is still open. */
      const finish = (open: boolean) => {
        clearTimeout(timeout);
        if (open) {
          try {
            dialog.close();
          } catch {
            return;
          }
        }
      };
      const timeout = setTimeout(() => {
        finish(true);
        reject(new Error("The sign-in dialog did not answer in time"));
      }, DIALOG_TIMEOUT_MS);
      dialog.addEventHandler(Office.EventType.DialogMessageReceived, (arg) => {
        finish(true);
        if (!("message" in arg)) {
          reject(new Error(`The sign-in dialog failed (${arg.error})`));
          return;
        }
        try {
          const message = JSON.parse(arg.message) as DialogAuthMessage;
          if (message.status === "success") {
            resolve({ accessToken: message.accessToken, expiresOn: message.expiresOn });
          } else {
            reject(new Error(message.message));
          }
        } catch (error) {
          reject(new Error(`The sign-in dialog sent an unreadable message (${error})`));
        }
      });
      dialog.addEventHandler(Office.EventType.DialogEventReceived, (arg) => {
        const code = "error" in arg ? arg.error : undefined;
        finish(code !== DIALOG_CLOSED_BY_USER);
        reject(
          new Error(
            code === DIALOG_CLOSED_BY_USER ? "The sign-in dialog was closed" : `The sign-in dialog failed (${code})`
          )
        );
      });
    });
  });
}
