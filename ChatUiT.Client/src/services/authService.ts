import { AccountInfo, AuthenticationResult, InteractionRequiredAuthError, BrowserAuthError, BrowserAuthErrorCodes } from "@azure/msal-browser";
import { getMsal } from "../msalInstance";
import { loginRequest, apiRequest, silentRedirectUri } from "../authConfig";
import { trackError } from "./telemetryService";

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

/** How the app signs in and gets API tokens. */
interface SignIn {
  readonly canSignOut: boolean;
  login(): Promise<void>;
  logout(): void;
  getAccessToken(): Promise<string | null>;
}

/** Signs in on the web with a redirect to the Microsoft sign-in page. */
class RedirectSignIn implements SignIn {
  readonly canSignOut = true;
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

  public async login(): Promise<void> {
    await this.startInteractiveRedirect(() => getMsal().loginRedirect(loginRequest));
  }

  public logout(): void {
    sessionStorage.removeItem(REDIRECT_GUARD_KEY);
    getMsal().logoutRedirect();
  }

  public async getAccessToken(): Promise<string | null> {
    const msal = getMsal();
    const account = msal.getActiveAccount();
    if (!account) {
      await this.login();
      return null;
    }

    try {
      const response = await msal.acquireTokenSilent({
        ...apiRequest,
        account: account,
        // Renew in an iframe that loads a blank page instead of the SPA.
        redirectUri: silentRedirectUri,
      });
      return response.accessToken;
    } catch (error) {
      if (needsInteraction(error)) {
        await this.startInteractiveRedirect(() => msal.acquireTokenRedirect({
          ...apiRequest,
          account: account,
        }));
        return null;
      }
      console.error("Error getting access token:", error);
      trackError("auth", { message: "An access token could not be acquired", error });
      throw error;
    }
  }
}

/** Signs in through Teams' nested app authentication. Teams owns the sign-in, so the app cannot sign out. */
class TeamsSignIn implements SignIn {
  readonly canSignOut = false;
  private readonly loginHint: string | undefined;
  private pending: Promise<string> | null = null;

  constructor(loginHint: string | undefined) {
    this.loginHint = loginHint;
  }

  public async login(): Promise<void> {
    await this.getAccessToken();
  }

  public logout(): void {}

  /** One token request at a time: concurrent callers share the request in flight. */
  public getAccessToken(): Promise<string> {
    this.pending ??= this.acquireToken().finally(() => {
      this.pending = null;
    });
    return this.pending;
  }

  /** Silently for the cached account, then through the Teams sign-in session, then in a Teams popup. */
  private async acquireToken(): Promise<string> {
    const msal = getMsal();
    const request = { scopes: loginRequest.scopes, loginHint: this.loginHint };
    const account = this.cachedAccount();
    if (account) {
      try {
        return this.use(await msal.acquireTokenSilent({ ...request, account }));
      } catch (error) {
        console.log("Unable to acquire token silently:", error);
      }
    }
    try {
      return this.use(await msal.ssoSilent(request));
    } catch (error) {
      console.log("Unable to acquire token through SSO:", error);
    }
    return this.use(await msal.acquireTokenPopup(request));
  }

  /** The cached account of the Teams user: the one matching the login hint, or with no hint the active or first one. */
  private cachedAccount(): AccountInfo | null {
    const msal = getMsal();
    if (this.loginHint) {
      return msal.getAccount({ username: this.loginHint });
    }
    return msal.getActiveAccount() ?? msal.getAllAccounts()[0] ?? null;
  }

  /** Makes the result's account the active one when it is not already, and returns the token. */
  private use(result: AuthenticationResult): string {
    const msal = getMsal();
    if (result.account && msal.getActiveAccount()?.homeAccountId !== result.account.homeAccountId) {
      msal.setActiveAccount(result.account);
    }
    return result.accessToken;
  }
}

class AuthService {
  private signIn: SignIn = new RedirectSignIn();

  /** Signs in through Teams' nested app authentication from now on. Call it after switchToNestedAppAuth. */
  public enableTeamsSignIn(loginHint: string | undefined): void {
    this.signIn = new TeamsSignIn(loginHint);
  }

  /** True when the app signs in through Teams. */
  public isTeams(): boolean {
    return this.signIn instanceof TeamsSignIn;
  }

  /** False in Teams, where Teams owns the sign-in. */
  public canSignOut(): boolean {
    return this.signIn.canSignOut;
  }

  // Called when an interactive redirect completed successfully, so a later
  // legitimate redirect (e.g. first-time consent for the API scope right
  // after login) isn't blocked by the loop guard.
  public clearRedirectGuard(): void {
    sessionStorage.removeItem(REDIRECT_GUARD_KEY);
  }

  public login(): Promise<void> {
    return this.signIn.login();
  }

  public logout(): void {
    this.signIn.logout();
  }

  public getAccount(): AccountInfo | null {
    return getMsal().getActiveAccount();
  }

  public async getAccessToken(): Promise<string | null> {
    // Defer to a macrotask: callers may (indirectly) invoke this during a
    // React render, and MSAL emits events synchronously, which would make
    // MsalProvider setState mid-render.
    await new Promise(resolve => setTimeout(resolve, 0));
    return this.signIn.getAccessToken();
  }

  public isAuthenticated(): boolean {
    return this.getAccount() !== null;
  }
}

const authService = new AuthService();
export default authService;
