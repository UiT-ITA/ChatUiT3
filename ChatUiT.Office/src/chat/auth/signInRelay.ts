/* global btoa, crypto, TextEncoder, URL */

import { API_ORIGIN, DEV_API_HOSTS } from "../config";

/**
 * What the browser sign-in page and the task pane share. The OAuth state is the sign-in id, followed in a
 * development build by "." and the name of the dev API host whose relay the pane polls.
 */

/** The sign-in result the relay holds: the authorization code, or Entra's error. */
export type SignInRelayResult = { code: string; error?: undefined } | { code?: undefined; error: string };

/** 32 random bytes in base64url. */
export function randomId(): string {
  return base64Url(crypto.getRandomValues(new Uint8Array(32)));
}

export function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function sha256(text: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
}

/** The OAuth state of a sign-in. */
export function makeState(id: string, devHost: string | null): string {
  return devHost ? `${id}.${devHost}` : id;
}

/** The sign-in id and the relay's API origin of an OAuth state, or null when the state is not one of ours. */
export function parseState(state: string): { id: string; origin: string } | null {
  const [id, devHost, ...rest] = state.split(".");
  if (!/^[A-Za-z0-9_-]{43}$/.test(id) || rest.length > 0) {
    return null;
  }
  if (!DEV_API_HOSTS) {
    return devHost === undefined ? { id, origin: API_ORIGIN } : null;
  }
  if (devHost === undefined || !Object.prototype.hasOwnProperty.call(DEV_API_HOSTS, devHost)) {
    return null;
  }
  return { id, origin: DEV_API_HOSTS[devHost] };
}

/** The six-digit code both the task pane and the sign-in page show for a sign-in id, as "123 456". */
export async function matchCode(id: string): Promise<string> {
  const hash = await sha256(id);
  const value = ((hash[0] << 16) | (hash[1] << 8) | hash[2]) % 1_000_000;
  const digits = value.toString().padStart(6, "0");
  return `${digits.slice(0, 3)} ${digits.slice(3)}`;
}

/** The relay URL of a sign-in id. An empty origin is the page's own. */
export function relayUrl(origin: string, id: string, pageUrl: string): string {
  return new URL(`/api/v1/office/sign-in/${id}`, origin || pageUrl).href;
}
