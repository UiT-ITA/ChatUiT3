import { AccountInfo, InteractionRequiredAuthError, BrowserAuthError, BrowserAuthErrorCodes } from "@azure/msal-browser";
import { msalInstance } from "../msalInstance";
import { loginRequest, apiRequest, silentRedirectUri } from "../authConfig";

// BrowserAuthError codes that mean silent renewal cannot succeed and
// interactive authentication is required instead.
const SILENT_RENEWAL_FAILURE_CODES: string[] = [
  BrowserAuthErrorCodes.blockIframeReload,
  BrowserAuthErrorCodes.timedOut,
  BrowserAuthErrorCodes.iframeClosedPrematurely,
  BrowserAuthErrorCodes.hashEmptyError,
];

const REDIRECT_GUARD_KEY = "auth.redirectInitiatedAt";
const REDIRECT_GUARD_WINDOW_MS = 30_000;

function needsInteraction(error: unknown): boolean {
  if (error instanceof InteractionRequiredAuthError) {
    return true;
  }
  return error instanceof BrowserAuthError &&
    SILENT_RENEWAL_FAILURE_CODES.includes(error.errorCode);
}

function isInteractionInProgress(error: unknown): boolean {
  return error instanceof BrowserAuthError &&
    error.errorCode === 'interaction_in_progress';
}

class AuthService {
  private interactiveRedirect: Promise<void> | null = null;

  // Ensures at most one interactive redirect is initiated at a time, and
  // that we don't loop: if a redirect was already initiated moments ago,
  // something is wrong with the auth flow and we fail instead of bouncing.
  private startInteractiveRedirect(redirect: () => Promise<void>): Promise<void> {
    if (this.interactiveRedirect) {
      return this.interactiveRedirect;
    }

    const initiatedAt = Number(sessionStorage.getItem(REDIRECT_GUARD_KEY));
    if (initiatedAt && Date.now() - initiatedAt < REDIRECT_GUARD_WINDOW_MS) {
      return Promise.reject(new Error(
        "Authentication redirect was already attempted moments ago; refusing to redirect again to avoid a loop."
      ));
    }
    sessionStorage.setItem(REDIRECT_GUARD_KEY, String(Date.now()));

    this.interactiveRedirect = redirect()
      .catch(error => {
        if (!isInteractionInProgress(error)) {
          throw error;
        }
      })
      .finally(() => {
        this.interactiveRedirect = null;
      });
    return this.interactiveRedirect;
  }

  // Called when an interactive redirect completed successfully, so a later
  // legitimate redirect (e.g. first-time consent for the API scope right
  // after login) isn't blocked by the loop guard.
  public clearRedirectGuard(): void {
    sessionStorage.removeItem(REDIRECT_GUARD_KEY);
  }

  public async login(): Promise<void> {
    await this.startInteractiveRedirect(() => msalInstance.loginRedirect(loginRequest));
  }

  public logout(): void {
    sessionStorage.removeItem(REDIRECT_GUARD_KEY);
    msalInstance.logoutRedirect();
  }

  public getAccount(): AccountInfo | null {
    return msalInstance.getActiveAccount();
  }

  public async getAccessToken(): Promise<string | null> {
    // Defer to a macrotask: callers may (indirectly) invoke this during a
    // React render, and MSAL emits events synchronously, which would make
    // MsalProvider setState mid-render.
    await new Promise(resolve => setTimeout(resolve, 0));

    const account = this.getAccount();
    if (!account) {
      await this.login();
      return null;
    }

    try {
      const response = await msalInstance.acquireTokenSilent({
        ...apiRequest,
        account: account,
        // Renew in an iframe that loads a blank page instead of the SPA.
        redirectUri: silentRedirectUri,
      });
      return response.accessToken;
    } catch (error) {
      if (needsInteraction(error)) {
        await this.startInteractiveRedirect(() => msalInstance.acquireTokenRedirect({
          ...apiRequest,
          account: account,
        }));
        return null;
      }
      console.error("Error getting access token:", error);
      throw error;
    }
  }

  /**
   * Asks the user to consent to extra delegated scopes (Microsoft Graph, for tools). The
   * token itself is discarded: the server acquires its own through On-Behalf-Of, which works
   * once consent is recorded. Tries silently, then a popup, then a redirect if popups are
   * blocked; after a redirect the page reloads and the pending tool call replays.
   */
  public async requestScopes(scopes: string[]): Promise<void> {
    const account = this.getAccount();
    if (!account) {
      await this.login();
      return;
    }

    try {
      await msalInstance.acquireTokenSilent({ scopes, account, redirectUri: silentRedirectUri });
      return;
    } catch (error) {
      if (!needsInteraction(error)) {
        throw error;
      }
    }

    try {
      await msalInstance.acquireTokenPopup({ scopes, account });
      this.clearRedirectGuard();
    } catch (error) {
      const popupBlocked = error instanceof BrowserAuthError &&
        (error.errorCode === BrowserAuthErrorCodes.popupWindowError || error.errorCode === BrowserAuthErrorCodes.emptyWindowError);
      if (!popupBlocked) {
        throw error;
      }
      await this.startInteractiveRedirect(() => msalInstance.acquireTokenRedirect({ scopes, account }));
    }
  }

  public isAuthenticated(): boolean {
    return this.getAccount() !== null;
  }
}

const authService = new AuthService();
export default authService;
