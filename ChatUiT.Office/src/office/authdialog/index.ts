/* global Office, URLSearchParams, window */

import { createStandardPublicClientApplication, type AuthenticationResult } from "@azure/msal-browser";
import { msalAuth, type DialogAuthMessage } from "../../chat/auth/msalAuth";

/**
 * The sign-in page the task pane opens in an Office dialog when the app has no nested app authentication.
 * It sends the access token to the task pane. The first load reads the scopes and login hint from its
 * query string, and uses a cached account when it has one. Otherwise it signs in with an MSAL redirect,
 * and the load after the redirect sends the token.
 */
Office.onReady(async () => {
  try {
    const pca = await createStandardPublicClientApplication({
      auth: {
        ...msalAuth,
        redirectUri: window.location.origin + window.location.pathname,
        navigateToLoginRequestUrl: false,
      },
      cache: { cacheLocation: "localStorage" },
    });
    const redirected = await pca.handleRedirectPromise();
    if (redirected) {
      sendToken(redirected);
      return;
    }
    const params = new URLSearchParams(window.location.search);
    const scopes = params.getAll("scope");
    const loginHint = params.get("loginHint") ?? undefined;
    const account = loginHint ? pca.getAccountByUsername(loginHint) : pca.getAllAccounts()[0];
    if (account) {
      try {
        sendToken(await pca.acquireTokenSilent({ scopes, account }));
        return;
      } catch {
        // The redirect below signs in again.
      }
    }
    await pca.acquireTokenRedirect({ scopes, loginHint });
  } catch (error) {
    send({ status: "error", message: String(error) });
  }
});

function sendToken(result: AuthenticationResult) {
  send({ status: "success", accessToken: result.accessToken, expiresOn: result.expiresOn?.toISOString() ?? null });
}

function send(message: DialogAuthMessage) {
  Office.context.ui.messageParent(JSON.stringify(message));
}
