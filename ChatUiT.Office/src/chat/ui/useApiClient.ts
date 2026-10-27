/* global localStorage */

import { useMemo, useState } from "react";
import { createResponsesClient, type ResponsesClient } from "../api/client";
import { requestScopes } from "../auth/accountManager";
import { API_ORIGIN, API_SCOPES, apiBaseUrl, DEV_API_HOSTS } from "../config";

const STORAGE_KEY = "chatuit.devApiHost";

export interface ApiClientHandle {
  client: ResponsesClient;
  /** Development builds only: the selected server and the servers to choose from. */
  dev: { host: string; hosts: readonly string[]; setHost(host: string): void } | null;
}

/** The API client. A development build can switch servers, and remembers the choice in this browser. */
export function useApiClient(): ApiClientHandle {
  const hosts = DEV_API_HOSTS ? Object.keys(DEV_API_HOSTS) : [];
  const [host, setHost] = useState(() => {
    const stored = readStoredHost();
    return stored && hosts.includes(stored) ? stored : hosts[0];
  });
  const origin = DEV_API_HOSTS && host ? DEV_API_HOSTS[host] : API_ORIGIN;
  const client = useMemo(
    () => createResponsesClient({ baseURL: apiBaseUrl(origin), getToken: () => requestScopes(API_SCOPES) }),
    [origin]
  );

  const select = (next: string) => {
    setHost(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage can be unavailable; the choice then lasts until the pane reloads.
    }
  };

  return { client, dev: DEV_API_HOSTS ? { host, hosts, setHost: select } : null };
}

function readStoredHost(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}
