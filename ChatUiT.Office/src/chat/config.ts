/* global CHATUIT_API_ORIGIN, CHATUIT_DEV_API_HOSTS, URL, window */

/**
 * The ChatUiT API. The origins come from environments.js. An empty origin is the page's own,
 * where the dev server forwards /api to the local server.
 */
export const API_ORIGIN = CHATUIT_API_ORIGIN;
/** The servers a development build can switch between, by name. Null in a production build. */
export const DEV_API_HOSTS = CHATUIT_DEV_API_HOSTS;
export const API_SCOPES = ["api://ec50c71e-1910-45bf-ba2a-eb463d80c024/access_as_user"];

export function apiBaseUrl(origin: string): string {
  return new URL("/api/v1", origin || window.location.origin).href;
}
