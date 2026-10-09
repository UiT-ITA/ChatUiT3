// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/* This file provides MSAL auth configuration to get access token through nested app authentication. */

/* global console */

import { createNestablePublicClientApplication, type IPublicClientApplication } from "@azure/msal-browser";

export { AccountManager };

const applicationId = "ec50c71e-1910-45bf-ba2a-eb463d80c024";

const msalConfig = {
  auth: {
    clientId: applicationId,
    authority: "https://login.microsoftonline.com/4e7f212d-74db-4563-a57b-8ae44ed05526",
    supportsNestedAppAuth: true,
  },
};

// Encapsulate functions for getting user account and token information.
class AccountManager {
  pca: IPublicClientApplication | undefined = undefined;

  // Initialize MSAL public client application.
  async initialize() {
    this.pca = await createNestablePublicClientApplication(msalConfig);
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
    };

    try {
      console.log("Trying to acquire token silently...");
      const userAccount = await this.pca.acquireTokenSilent(tokenRequest);
      console.log("Acquired token silently.");
      return userAccount;
    } catch (error) {
      console.log(`Unable to acquire token silently: ${error}`);
    }

    // Acquire token silent failure. Send an interactive request via popup.
    try {
      console.log("Trying to acquire token interactively...");
      const userAccount = await this.pca.acquireTokenPopup(tokenRequest);
      console.log("Acquired token interactively.");
      return userAccount;
    } catch (popupError) {
      // Acquire token interactive failure.
      console.log(`Unable to acquire token interactively: ${popupError}`);
      throw new Error(`Unable to acquire access token: ${popupError}`);
    }
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
