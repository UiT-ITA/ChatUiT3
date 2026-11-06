import authService from "./authService";

/**
 * Usage and error records for POST /api/telemetry. Records are queued and sent in batches,
 * at most every few seconds and when the page is hidden. Sending never shows a toast and
 * never starts a sign-in: without a signed-in account the queue waits.
 *
 * Records never carry content. An error record carries the error's name and a message
 * written in this code base, never the error's own message.
 */

export type ClientErrorKind =
  | "render"
  | "unhandled_rejection"
  | "network"
  | "realtime"
  | "auth"
  | "file_import"
  | "render_markdown"
  | "render_mermaid"
  | "clipboard"
  | "storage"
  | "tokenizer"
  | "client_tool";

type FieldValue = string | number | null | undefined;

interface TelemetryRecord {
  name: string;
  fields: Record<string, FieldValue>;
}

const ENDPOINT = "/api/telemetry";
const FLUSH_INTERVAL_MS = 5000;
const MAX_BATCH = 50;
const MAX_QUEUE = 500;

export const CLIENT_APP = "web";
export const CLIENT_VERSION: string = __APP_VERSION__;
export const CLIENT_SESSION: string =
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

/** The headers every API call sends so the server can attribute its records. */
export function telemetryHeaders(): Record<string, string> {
  return {
    "X-ChatUiT-Client": CLIENT_APP,
    "X-ChatUiT-Version": CLIENT_VERSION,
    "X-ChatUiT-Session": CLIENT_SESSION,
  };
}

/** The same values as query parameters, for the SignalR connection. */
export function telemetryQuery(): string {
  const params = new URLSearchParams({
    client: CLIENT_APP,
    client_version: CLIENT_VERSION,
    client_session: CLIENT_SESSION,
  });
  return params.toString();
}

let queue: TelemetryRecord[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let currentRoute = "unknown";

/** Sets the route template that error records carry. */
export function setCurrentRoute(route: string): void {
  currentRoute = route;
}

/** Queues a usage record. */
export function track(name: string, fields: Record<string, FieldValue> = {}): void {
  if (queue.length >= MAX_QUEUE) {
    return;
  }
  queue.push({ name, fields });
  schedule();
}

interface ErrorDetails {
  /** A message written in this code base. Never the error's own message. */
  message?: string;
  error?: unknown;
  httpStatus?: number;
  errorCode?: string;
  extra?: Record<string, FieldValue>;
}

/** Queues a client.error record. */
export function trackError(kind: ClientErrorKind, details: ErrorDetails = {}): void {
  track("client.error", {
    kind,
    "error.name": errorName(details.error),
    message: details.message,
    route: currentRoute,
    "http.status": details.httpStatus,
    "error.code": details.errorCode ?? errorCode(details.error),
    ...details.extra,
  });
}

/** The name of an error: its class name, or the type of a thrown value that is not an Error. */
export function errorName(error: unknown): string | undefined {
  if (error === undefined) {
    return undefined;
  }
  if (error instanceof Error) {
    return error.name;
  }
  return typeof error;
}

/** The MSAL errorCode of an error, when it has one. */
function errorCode(error: unknown): string | undefined {
  if (error && typeof error === "object" && "errorCode" in error) {
    const code = (error as { errorCode: unknown }).errorCode;
    return typeof code === "string" ? code : undefined;
  }
  return undefined;
}

function schedule(): void {
  if (timer !== null) {
    return;
  }
  timer = setTimeout(() => {
    timer = null;
    void flush(false);
  }, FLUSH_INTERVAL_MS);
}

async function flush(keepalive: boolean): Promise<void> {
  if (queue.length === 0 || !authService.isAuthenticated()) {
    return;
  }

  const token = await authService.getAccessToken().catch(() => null);
  if (!token) {
    return;
  }

  while (queue.length > 0) {
    const batch = queue.slice(0, MAX_BATCH);
    queue = queue.slice(MAX_BATCH);
    try {
      await fetch(ENDPOINT, {
        method: "POST",
        keepalive,
        headers: {
          ...telemetryHeaders(),
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ records: batch.map(r => ({ name: r.name, fields: withoutEmpty(r.fields) })) }),
      });
    } catch {
      // A batch that cannot be sent is dropped.
    }
  }
}

function withoutEmpty(fields: Record<string, FieldValue>): Record<string, string | number> {
  const result: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined && value !== null && value !== "") {
      result[key] = typeof value === "string" ? value.slice(0, 300) : value;
    }
  }
  return result;
}

let started = false;

/** Records unhandled promise rejections and sends the queue when the page is hidden. */
export function startTelemetry(): void {
  if (started) {
    return;
  }
  started = true;

  window.addEventListener("unhandledrejection", event => {
    trackError("unhandled_rejection", { error: event.reason });
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      void flush(true);
    }
  });
}
