/* global crypto, document, fetch, setTimeout, TextEncoder, URL, window, CHATUIT_APP_VERSION */

/**
 * Usage and error records for POST /api/telemetry, as the ChatUiT web client sends them (telemetryService.ts).
 * Records are queued and sent in batches, at most every few seconds and when the pane is hidden. Nothing is
 * recorded before `startTelemetry`. Sending never opens a sign-in: without a silently acquired token the queue waits.
 *
 * Records never carry content. An error record carries the error's name and a message written in this code base,
 * never the error's own message.
 */

/** The client.app values the server knows, one per app. */
export type ClientApp = "word" | "excel" | "powerpoint" | "outlook" | "teams";

export type ClientErrorKind =
  "render" | "unhandled_rejection" | "network" | "auth" | "file_import" | "storage" | "client_tool";

type FieldValue = string | number | null | undefined;

interface TelemetryRecord {
  name: string;
  fields: Record<string, FieldValue>;
}

export interface TelemetryOptions {
  app: ClientApp;
  /** The pane, sent as the route of client.page_viewed and of error records. */
  route: string;
  /** An access token for the ChatUiT API, or null when none can be had without the user. */
  getToken: () => Promise<string | null>;
}

const ENDPOINT = "/api/telemetry";
const FLUSH_INTERVAL_MS = 5000;
const MAX_BATCH = 50;
const MAX_QUEUE = 500;
const MAX_RETRY_MS = 60000;
/** Below the server's 64 KB request limit and the browser's 64 KB limit on keepalive bodies in flight. */
const MAX_BODY_BYTES = 60000;
/** The bytes of `{"records":[` and `]}`. */
const BODY_OVERHEAD_BYTES = 14;
const encoder = new TextEncoder();

const CLIENT_SESSION: string =
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

let options: (TelemetryOptions & { version: string }) | null = null;
let apiOrigin = "";
const queue: TelemetryRecord[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let lastToken: string | null = null;
let retryDelay = FLUSH_INTERVAL_MS;

/** The headers every API call sends so the server can attribute its records. Empty before `startTelemetry`. */
export function telemetryHeaders(): Record<string, string> {
  if (!options) {
    return {};
  }
  return {
    "X-ChatUiT-Client": options.app,
    "X-ChatUiT-Version": options.version,
    "X-ChatUiT-Session": CLIENT_SESSION,
  };
}

/** Sets the ChatUiT server the records go to. An empty origin is the page's own. */
export function setTelemetryOrigin(origin: string): void {
  apiOrigin = origin;
}

/** Queues a usage record. */
export function track(name: string, fields: Record<string, FieldValue> = {}): void {
  if (!options || queue.length >= MAX_QUEUE) {
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
    route: options?.route,
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

function schedule(delay = FLUSH_INTERVAL_MS): void {
  if (timer !== null) {
    return;
  }
  timer = setTimeout(() => {
    timer = null;
    void flush(false);
  }, delay);
}

/**
 * Sends the queue. Without a token the queue is kept and sending is retried, each time after twice the delay, up to
 * {@link MAX_RETRY_MS}. A keepalive flush uses the last token at once when there is one, and sends at most
 * {@link MAX_BODY_BYTES} in all without waiting for the responses.
 */
async function flush(keepalive: boolean): Promise<void> {
  if (!options || queue.length === 0) {
    return;
  }

  let token = keepalive ? lastToken : null;
  if (!token) {
    token = await options.getToken().catch(() => null);
  }
  if (!token) {
    retryDelay = Math.min(retryDelay * 2, MAX_RETRY_MS);
    schedule(retryDelay);
    return;
  }
  lastToken = token;
  retryDelay = FLUSH_INTERVAL_MS;
  const url = new URL(ENDPOINT, apiOrigin || window.location.origin).href;
  let budget = MAX_BODY_BYTES;
  while (queue.length > 0) {
    const batch = takeBatch(budget);
    if (!batch) {
      break;
    }
    if (keepalive) {
      budget -= batch.bytes;
    }
    const sending = fetch(url, {
      method: "POST",
      keepalive,
      headers: {
        ...telemetryHeaders(),
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: batch.body,
    }).catch(() => {
      // A batch that cannot be sent is dropped.
    });
    if (!keepalive) {
      await sending;
    }
  }
}

/**
 * Takes the next records off the queue, at most {@link MAX_BATCH} and at most `maxBytes` of request body. A record
 * larger than {@link MAX_BODY_BYTES} on its own is dropped. Null when nothing fits.
 */
function takeBatch(maxBytes: number): { body: string; bytes: number } | null {
  const records: string[] = [];
  let bytes = BODY_OVERHEAD_BYTES;
  while (queue.length > 0 && records.length < MAX_BATCH) {
    const record = JSON.stringify({ name: queue[0].name, fields: withoutEmpty(queue[0].fields) });
    const recordBytes = encoder.encode(record).length + (records.length > 0 ? 1 : 0);
    if (bytes + recordBytes > maxBytes) {
      if (records.length === 0 && BODY_OVERHEAD_BYTES + recordBytes > MAX_BODY_BYTES) {
        queue.shift();
        continue;
      }
      break;
    }
    records.push(record);
    bytes += recordBytes;
    queue.shift();
  }
  return records.length > 0 ? { body: `{"records":[${records.join(",")}]}`, bytes } : null;
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

/**
 * Starts recording for the pane: records client.page_viewed, records unhandled promise rejections, and sends the
 * queue when the pane is hidden.
 */
export function startTelemetry(start: TelemetryOptions): void {
  if (options) {
    return;
  }
  options = { ...start, version: CHATUIT_APP_VERSION };

  window.addEventListener("unhandledrejection", (event) => {
    trackError("unhandled_rejection", { error: event.reason });
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      void flush(true);
    }
  });

  track("client.page_viewed", { route: start.route });
}
