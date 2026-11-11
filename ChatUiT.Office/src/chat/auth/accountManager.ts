// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/* This file provides MSAL auth configuration to get access token through nested app authentication. */

/* global console, Date, window */

import {
  BrowserAuthError,
  BrowserAuthErrorCodes,
  createNestablePublicClientApplication,
  type AccountInfo,
  type IPublicClientApplication,
} from "@azure/msal-browser";
import { trackError } from "../telemetry/telemetryService";
import { msalAuth, type DialogToken } from "./msalAuth";

export { AccountManager };

const msalConfig = {
  auth: {
    ...msalAuth,
    supportsNestedAppAuth: true,
  },
  cache: {
    cacheLocation: "localStorage",
  },
};

/** Opens a sign-in dialog for the scopes and resolves with its token. */
export type SignInDialog = (scopes: string[], loginHint: string | undefined) => Promise<DialogToken>;

/** A dialog token is used until this many milliseconds before it expires. */
const DIALOG_TOKEN_MARGIN_MS = 5 * 60 * 1000;

/** The sessionStorage key of the dialog tokens. */
const DIALOG_TOKENS_KEY = "chatuit.dialogTokens";

/** A dialog token and the time it expires, in milliseconds since the epoch. */
type StoredDialogToken = { accessToken: string; expiresOn: number };

let getLoginHint: (() => Promise<string | undefined>) | undefined;
let openSignInDialog: SignInDialog | undefined;

/** Sets the function that returns the signed-in user's name, used as the MSAL login hint. */
export function configureLoginHint(get: () => Promise<string | undefined>) {
  getLoginHint = get;
}

/** Sets the sign-in dialog used when the popup sign-in cannot open a window. */
export function configureSignInDialog(open: SignInDialog) {
  openSignInDialog = open;
}

// Encapsulate functions for getting user account and token information.
class AccountManager {
  pca: IPublicClientApplication | undefined = undefined;
  account: AccountInfo | undefined = undefined;
  loginHint: string | undefined = undefined;
  /** Tokens from the sign-in dialog, by scopes. */
  dialogTokens = readDialogTokens();
  /** The token requests in progress, by scopes. */
  tokenRequests = new Map<string, Promise<string>>();
  /** True after a popup sign-in could not open a window. Sign-in then goes straight to the dialog. */
  popupBlocked = false;

  // Initialize MSAL public client application and read the login hint.
  async initialize() {
    this.pca = await createNestablePublicClientApplication(msalConfig);
    this.loginHint = await getLoginHint?.();
  }

  /** Returns a token for the scopes. Calls for the same scopes at the same time share one sign-in. */
  async ssoGetToken(scopes: string[]) {
    const cached = this.cachedDialogToken(scopes);
    if (cached) {
      return cached;
    }
    const key = scopeKey(scopes);
    let request = this.tokenRequests.get(key);
    if (!request) {
      request = this.acquireToken(scopes).finally(() => this.tokenRequests.delete(key));
      this.tokenRequests.set(key, request);
    }
    return request;
  }

  /** Signs in through MSAL, or through the sign-in dialog when the popup cannot open a window. */
  async acquireToken(scopes: string[]): Promise<string> {
    const open = openSignInDialog;
    if (!open) {
      return (await this.ssoGetUserIdentity(scopes)).accessToken;
    }
    if (!this.popupBlocked) {
      try {
        return (await this.ssoGetUserIdentity(scopes)).accessToken;
      } catch (error) {
        if (!(error instanceof Error) || !isPopupBlocked(error.cause)) {
          throw error;
        }
        this.popupBlocked = true;
      }
    }
    console.log("Trying to acquire token through the sign-in dialog...");
    return this.dialogGetToken(open, scopes);
  }

  /** Signs in through the sign-in dialog and caches the token when it has an expiry time. */
  async dialogGetToken(open: SignInDialog, scopes: string[]): Promise<string> {
    try {
      const token = await open(scopes, this.loginHint);
      console.log("Acquired token through the sign-in dialog.");
      const expiresOn = token.expiresOn ? Date.parse(token.expiresOn) : NaN;
      if (!Number.isNaN(expiresOn)) {
        this.dialogTokens.set(scopeKey(scopes), { accessToken: token.accessToken, expiresOn });
        writeDialogTokens(this.dialogTokens);
      }
      return token.accessToken;
    } catch (dialogError) {
      console.log(`Unable to acquire token through the sign-in dialog: ${dialogError}`);
      trackError("auth", {
        message: "An access token could not be acquired through the sign-in dialog",
        error: dialogError,
      });
      throw new Error(`Unable to acquire access token: ${dialogError}`, { cause: dialogError });
    }
  }

  /** Returns the dialog token for the scopes while it has not expired, or null. */
  cachedDialogToken(scopes: string[]): string | null {
    const token = this.dialogTokens.get(scopeKey(scopes));
    if (!token || token.expiresOn - DIALOG_TOKEN_MARGIN_MS <= Date.now()) {
      return null;
    }
    return token.accessToken;
  }

  /** Drops every dialog token, so the next request signs in again. */
  forgetDialogTokens() {
    this.dialogTokens.clear();
    writeDialogTokens(this.dialogTokens);
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
      if (!openSignInDialog || !isPopupBlocked(popupError)) {
        trackError("auth", { message: "An access token could not be acquired", error: popupError });
      }
      throw new Error(`Unable to acquire access token: ${popupError}`, { cause: popupError });
    }
  }

  /** Returns a token from the cache or a silent refresh, or null. Never shows a prompt. */
  async silentToken(scopes: string[]): Promise<string | null> {
    const cached = this.cachedDialogToken(scopes);
    if (cached) {
      return cached;
    }
    const account = this.findAccount();
    if (this.pca === undefined || account === undefined) {
      return null;
    }
    try {
      return (await this.pca.acquireTokenSilent({ scopes, account })).accessToken;
    } catch {
      return null;
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

function scopeKey(scopes: string[]): string {
  return [...scopes].sort().join(" ");
}

/** True for the MSAL error of a popup sign-in that could not open a window. */
function isPopupBlocked(error: unknown): boolean {
  return error instanceof BrowserAuthError && error.errorCode === BrowserAuthErrorCodes.popupWindowError;
}

/** Reads the dialog tokens from sessionStorage. Empty when there are none or storage is unavailable. */
function readDialogTokens(): Map<string, StoredDialogToken> {
  try {
    const stored = window.sessionStorage.getItem(DIALOG_TOKENS_KEY);
    return new Map(stored ? (JSON.parse(stored) as [string, StoredDialogToken][]) : []);
  } catch {
    return new Map();
  }
}

/** Writes the dialog tokens to sessionStorage, when storage is available. */
function writeDialogTokens(tokens: Map<string, StoredDialogToken>) {
  try {
    window.sessionStorage.setItem(DIALOG_TOKENS_KEY, JSON.stringify([...tokens]));
  } catch {
    return;
  }
}

const accountManager = new AccountManager();
let initialization: Promise<void> | undefined;

/**
 * Returns an access token for the given scopes through nested app authentication.
 * The first call for a scope the user has not consented to opens the consent prompt.
 */
export async function requestScopes(scopes: string[]): Promise<string> {
  await initialize();
  return accountManager.ssoGetToken(scopes);
}

/** Drops the tokens from the sign-in dialog. Call it when the server rejects a token. */
export function forgetDialogTokens() {
  accountManager.forgetDialogTokens();
}

/** Returns an access token for the given scopes from the cache or a silent refresh, or null. Never shows a prompt. */
export async function requestScopesSilently(scopes: string[]): Promise<string | null> {
  try {
    await initialize();
  } catch {
    return null;
  }
  return accountManager.silentToken(scopes);
}

/** Initializes MSAL once. A failed initialization is tried again on the next call. */
function initialize(): Promise<void> {
  initialization ??= accountManager.initialize().catch((error: unknown) => {
    initialization = undefined;
    trackError("auth", { message: "Sign-in could not start", error });
    throw error;
  });
  return initialization;
}
