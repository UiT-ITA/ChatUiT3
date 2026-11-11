/* global clearTimeout, console, Date, fetch, localStorage, Response, setTimeout, URL, URLSearchParams, window */

import { msalAuth } from "./msalAuth";
import { base64Url, makeState, matchCode, randomId, relayUrl, sha256, type SignInRelayResult } from "./signInRelay";

/**
 * Sign-in in the user's default browser, for hosts where the pane can open neither a popup nor an Office
 * dialog. The pane shows a link to Entra's sign-in page. Entra returns to authdialog.html in the browser,
 * which posts the authorization code to the ChatUiT server's relay. The pane polls the relay, redeems the
 * code with its PKCE verifier, and keeps the access and refresh tokens in localStorage.
 */

/** What the pane shows while a browser sign-in waits for the user. */
export interface SignInPrompt {
  /** Entra's sign-in page. */
  url: string;
  /** The code the sign-in page shows too, as "123 456". */
  matchCode: string;
  cancel(): void;
}

/** The relay is polled this often while a sign-in waits. */
const POLL_INTERVAL_MS = 2000;

/** A sign-in that has no result after this long fails. */
const SIGN_IN_TIMEOUT_MS = 10 * 60 * 1000;

/** An access token is used until this many milliseconds before it expires. */
const TOKEN_MARGIN_MS = 5 * 60 * 1000;

/** The localStorage key of the tokens. */
const STORAGE_KEY = "chatuit.browserTokens";

/** The scopes every sign-in asks for besides the API's. offline_access gives the refresh token. */
const SIGN_IN_SCOPES = ["openid", "profile", "offline_access"];

type StoredTokens = { accessToken: string; expiresOn: number; refreshToken: string | null };

type TokenResponse = {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  error?: string;
  error_description?: string;
};

let relayOrigin = "";
let relayDevHost: string | null = null;

/** Sets the ChatUiT server whose relay the sign-in uses. devHost is the dev API host's name, null in production. */
export function setSignInRelay(origin: string, devHost: string | null) {
  relayOrigin = origin;
  relayDevHost = devHost;
}

let prompt: SignInPrompt | null = null;
const listeners = new Set<() => void>();

/** Calls the listener when the sign-in prompt appears or goes. Returns the unsubscribe function. */
export function subscribeSignInPrompt(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The sign-in prompt to show, or null. */
export function getSignInPrompt(): SignInPrompt | null {
  return prompt;
}

function setPrompt(next: SignInPrompt | null) {
  prompt = next;
  for (const listener of listeners) {
    listener();
  }
}

const tokens = readTokens();

/** True when an earlier browser sign-in left tokens for the scopes. */
export function hasBrowserSession(scopes: string[]): boolean {
  return tokens.has(scopeKey(scopes));
}

/** Returns a token from an earlier browser sign-in, refreshed when needed, or null. Never shows a prompt. */
export async function browserSilentToken(scopes: string[]): Promise<string | null> {
  const key = scopeKey(scopes);
  const stored = tokens.get(key);
  if (!stored) {
    return null;
  }
  if (stored.expiresOn - TOKEN_MARGIN_MS > Date.now()) {
    return stored.accessToken;
  }
  if (!stored.refreshToken) {
    return null;
  }
  try {
    return await redeem(scopes, { grant_type: "refresh_token", refresh_token: stored.refreshToken });
  } catch (error) {
    console.log(`Unable to refresh the browser sign-in token: ${error}`);
    tokens.delete(key);
    writeTokens();
    return null;
  }
}

/** Returns a token from an earlier browser sign-in, or signs in through the browser. */
export async function browserSignInToken(scopes: string[], loginHint: string | undefined): Promise<string> {
  return (await browserSilentToken(scopes)) ?? signInInteractively(scopes, loginHint);
}

async function signInInteractively(scopes: string[], loginHint: string | undefined): Promise<string> {
  const id = randomId();
  const verifier = randomId();
  const redirectUri = new URL("authdialog.html", window.location.href).href;
  const url = new URL(`${msalAuth.authority}/oauth2/v2.0/authorize`);
  url.search = new URLSearchParams({
    client_id: msalAuth.clientId,
    response_type: "code",
    response_mode: "fragment",
    redirect_uri: redirectUri,
    scope: [...scopes, ...SIGN_IN_SCOPES].join(" "),
    state: makeState(id, relayDevHost),
    code_challenge: base64Url(await sha256(verifier)),
    code_challenge_method: "S256",
    ...(loginHint ? { login_hint: loginHint } : {}),
  }).toString();
  const code = await waitForCode(url.href, id, await matchCode(id), relayUrl(relayOrigin, id, window.location.href));
  return redeem(scopes, {
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    code_verifier: verifier,
  });
}

/** Shows the prompt and polls the relay until it has the code, the user cancels or the sign-in times out. */
function waitForCode(url: string, id: string, code: string, relay: string): Promise<string> {
  return new Promise((resolve, reject) => {
    let done = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = () => {
      done = true;
      clearTimeout(timer);
      clearTimeout(deadline);
      if (prompt?.url === url) {
        setPrompt(null);
      }
    };
    const deadline = setTimeout(() => {
      finish();
      reject(new Error("The browser sign-in did not finish in time"));
    }, SIGN_IN_TIMEOUT_MS);
    const poll = async () => {
      let result: SignInRelayResult | null = null;
      try {
        result = await takeResult(relay);
      } catch (error) {
        console.log(`Unable to read the sign-in relay: ${error}`);
      }
      if (done) {
        return;
      }
      if (result) {
        finish();
        if (result.code) {
          resolve(result.code);
        } else {
          reject(new Error(`The browser sign-in failed: ${result.error}`));
        }
        return;
      }
      timer = setTimeout(() => void poll(), POLL_INTERVAL_MS);
    };
    setPrompt({
      url,
      matchCode: code,
      cancel: () => {
        if (!done) {
          finish();
          reject(new Error("The sign-in was cancelled"));
        }
      },
    });
    console.log(`Waiting for the browser sign-in ${id.slice(0, 6)}...`);
    void poll();
  });
}

/** The relay's result, or null while there is none. */
async function takeResult(relay: string): Promise<SignInRelayResult | null> {
  const response = await fetch(relay, { cache: "no-store" });
  if (response.status === 204) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`The sign-in relay answered ${response.status}`);
  }
  return (await response.json()) as SignInRelayResult;
}

/** Calls Entra's token endpoint, stores the tokens and returns the access token. */
async function redeem(scopes: string[], grant: Record<string, string>): Promise<string> {
  const response: Response = await fetch(`${msalAuth.authority}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: msalAuth.clientId,
      scope: [...scopes, ...SIGN_IN_SCOPES].join(" "),
      ...grant,
    }).toString(),
  });
  const body = (await response.json()) as TokenResponse;
  if (!response.ok || !body.access_token || !body.expires_in) {
    throw new Error(body.error_description || body.error || `The token endpoint answered ${response.status}`);
  }
  tokens.set(scopeKey(scopes), {
    accessToken: body.access_token,
    expiresOn: Date.now() + body.expires_in * 1000,
    refreshToken: body.refresh_token ?? grant.refresh_token ?? null,
  });
  writeTokens();
  return body.access_token;
}

function scopeKey(scopes: string[]): string {
  return [...scopes].sort().join(" ");
}

/** Reads the tokens from localStorage. Empty when there are none or storage is unavailable. */
function readTokens(): Map<string, StoredTokens> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return new Map(stored ? (JSON.parse(stored) as [string, StoredTokens][]) : []);
  } catch {
    return new Map();
  }
}

/** Writes the tokens to localStorage, when storage is available. */
function writeTokens() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...tokens]));
  } catch {
    return;
  }
}
