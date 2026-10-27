// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/* This file provides MSAL auth configuration to get access token through nested app authentication. */

/* global console */

import {
  createNestablePublicClientApplication,
  type AccountInfo,
  type IPublicClientApplication,
} from "@azure/msal-browser";

export { AccountManager };

const applicationId = "ec50c71e-1910-45bf-ba2a-eb463d80c024";

const msalConfig = {
  auth: {
    clientId: applicationId,
    authority: "https://login.microsoftonline.com/4e7f212d-74db-4563-a57b-8ae44ed05526",
    supportsNestedAppAuth: true,
  },
  cache: {
    cacheLocation: "localStorage",
  },
};

let getLoginHint: (() => Promise<string | undefined>) | undefined;

/** Sets the function that returns the signed-in user's name, used as the MSAL login hint. */
export function configureLoginHint(get: () => Promise<string | undefined>) {
  getLoginHint = get;
}

// Encapsulate functions for getting user account and token information.
class AccountManager {
  pca: IPublicClientApplication | undefined = undefined;
  account: AccountInfo | undefined = undefined;
  loginHint: string | undefined = undefined;

  // Initialize MSAL public client application and read the login hint.
  async initialize() {
    this.pca = await createNestablePublicClientApplication(msalConfig);
    this.loginHint = await getLoginHint?.();
  }

  async ssoGetToken(scopes: string[]) {
    const userAccount = await this.ssoGetUserIdentity(scopes);
    return userAccount.accessToken;
  }

  /**
   * Uses MSAL and nested app authentication to get the user account from Office SSO.
   * This demonstrates how to work with user identity from the token.
   *
   * @returns The user account data (identity).
   */
  async ssoGetUserIdentity(scopes: string[]) {
    if (this.pca === undefined) {
      throw new Error("AccountManager is not initialized!");
    }

    // Specify minimum scopes needed for the access token.
    const tokenRequest = {
      scopes: scopes,
      loginHint: this.loginHint,
    };

    try {
      console.log("Trying to acquire token silently...");
      const userAccount = await this.pca.acquireTokenSilent({ ...tokenRequest, account: this.findAccount() });
      console.log("Acquired token silently.");
      this.account = userAccount.account;
      return userAccount;
    } catch (error) {
      console.log(`Unable to acquire token silently: ${error}`);
    }

    // Acquire token silent failure. Try SSO with the user's existing session.
    try {
      console.log("Trying to acquire token through SSO...");
      const userAccount = await this.pca.ssoSilent(tokenRequest);
      console.log("Acquired token through SSO.");
      this.account = userAccount.account;
      return userAccount;
    } catch (error) {
      console.log(`Unable to acquire token through SSO: ${error}`);
    }

    // Acquire token silent failure. Send an interactive request via popup.
    try {
      console.log("Trying to acquire token interactively...");
      const userAccount = await this.pca.acquireTokenPopup(tokenRequest);
      console.log("Acquired token interactively.");
      this.account = userAccount.account;
      return userAccount;
    } catch (popupError) {
      // Acquire token interactive failure.
      console.log(`Unable to acquire token interactively: ${popupError}`);
      throw new Error(`Unable to acquire access token: ${popupError}`, { cause: popupError });
    }
  }

  /** Returns the signed-in account: the last one used, the one matching the login hint, or the first cached one. */
  private findAccount(): AccountInfo | undefined {
    if (this.pca === undefined) {
      return undefined;
    }
    if (this.account) {
      return this.account;
    }
    if (this.loginHint) {
      return this.pca.getAccountByUsername(this.loginHint) ?? undefined;
    }
    return this.pca.getAllAccounts()[0];
  }
}

const accountManager = new AccountManager();
let initialization: Promise<void> | undefined;

/**
 * Returns an access token for the given scopes through nested app authentication.
 * The first call for a scope the user has not consented to opens the consent prompt.
 */
export async function requestScopes(scopes: string[]): Promise<string> {
  initialization ??= accountManager.initialize().catch((error: unknown) => {
    initialization = undefined;
    throw error;
  });
  await initialization;
  return accountManager.ssoGetToken(scopes);
}
