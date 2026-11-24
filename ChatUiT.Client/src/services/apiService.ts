import authService from "./authService";
import { addNotification } from "./notificationService";
import type { NotifyLevel } from "../types/notification";
import { telemetryHeaders, trackError } from "./telemetryService";
import i18n from "i18next";
import { CodedError, ErrorCode, formatError } from "../errors/errorCodes";

// const API_BASE_URL = "https://localhost:7254";
const API_BASE_URL = "";

/** A non-2xx response. The toast has already been shown by the time this is thrown. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly endpoint: string,
    /** The text shown to the user, with its code and reference. */
    readonly displayMessage: string,
    readonly errorCode: string,
    readonly ref?: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** The header that carries the reference of the request. */
const REF_HEADER = "X-ChatUiT-Ref";

/** Matches a text that already ends with one or more codes, as in "(E1234)", "(E1234, ref 3f9a1c2e)" or "(E1234, E1235, ref 3f9a1c2e)". */
const CODED_TEXT = /\((E\d{4})(?:, E\d{4})*(?:, ref [0-9a-f]+)?\)\s*$/;

/** The client code and text of the legacy error codes the server sends without a message. */
const LEGACY_ERRORS: Record<string, { code: ErrorCode; key: string }> = {
  tools_not_allowed: { code: ErrorCode.ToolsNotAllowed, key: "errors.toolsNotAllowed" },
  knowledge_sources_not_allowed: { code: ErrorCode.KnowledgeSourcesNotAllowed, key: "errors.knowledgeSourcesNotAllowed" },
  invalid_tools: { code: ErrorCode.InvalidTools, key: "errors.invalidTools" },
  invalid_group_ids: { code: ErrorCode.InvalidGroupIds, key: "errors.invalidGroupIds" },
  unknown_knowledge_sources: { code: ErrorCode.UnknownKnowledgeSources, key: "errors.unknownKnowledgeSources" },
  course_version_changed: { code: ErrorCode.CourseVersionChanged, key: "errors.courseVersionChanged" },
};

/** The client code and text for a status the server sent no message for. */
function statusFallback(status: number): { code: ErrorCode; text: string } {
  if (status === 401) return { code: ErrorCode.Unauthorized, text: "You are not authorized to perform this action." };
  if (status === 403) return { code: ErrorCode.Forbidden, text: "You are not authorized to perform this action." };
  if (status === 404) return { code: ErrorCode.NotFound, text: "Resource not found." };
  if (status === 413) return { code: ErrorCode.TooLarge, text: i18n.t("errors.tooLarge") };
  if (status === 429) return { code: ErrorCode.RateLimited, text: "Rate limit reached. Please try again." };
  if (status >= 500) return { code: ErrorCode.ServerError, text: "Internal server error. Please try again." };
  return { code: ErrorCode.RequestFailed, text: `Request failed (${status}).` };
}

/**
 * Sends an authenticated request and returns the successful response. A non-2xx response
 * shows a toast and throws ApiError. A FormData body is sent as multipart, anything else as JSON.
 */
async function send(
  endpoint: string,
  options: RequestInit,
  accept: string
): Promise<Response> {
  const token = await authService.getAccessToken();

  const headers = new Headers(options.headers);
  headers.set("Accept", accept);
  for (const [name, value] of Object.entries(telemetryHeaders())) {
    headers.set(name, value);
  }
  if (!(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  } else if (!authService.isAuthenticated()) {
    throw new CodedError(ErrorCode.NotSignedIn, i18n.t("errors.notSignedIn"));
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });
  } catch (err) {
    const networkError = new CodedError(ErrorCode.Network, i18n.t("errors.network"), undefined, { cause: err });
    addNotification({ level: "Error", message: networkError.displayMessage });
    trackError("network", { message: "The request did not reach the server", error: err });
    throw networkError;
  }

  if (!response.ok) {

    let ref = response.headers.get(REF_HEADER) || undefined;
    let serverMessage: string | undefined;
    let serverCode: string | undefined;
    let legacy: { code: ErrorCode; key: string } | undefined;
    try {
      const ct = response.headers.get("content-type") || "";
      if (ct.includes("application/json")) {
        const data = await response.json();
        if (typeof data === "string") {
          serverMessage = data;
        } else if (data?.message) {
          serverMessage = String(data.message);
          serverCode = typeof data.errorCode === "string" ? data.errorCode : undefined;
          ref ??= typeof data.ref === "string" ? data.ref : undefined;
        } else if (typeof data?.error === "string") {
          legacy = LEGACY_ERRORS[data.error];
        }
      } else {
        const text = await response.text();
        serverMessage = text || undefined;
      }
    } catch {
      // An unreadable body just means no server message; the status-based fallback is used.
    }

    const status = response.status;
    const level: NotifyLevel =
      status >= 500 ? "Error" :
      status === 401 || status === 403 ? "Warning" :
      status === 404 ? "Warning" :
      status === 429 ? "Warning" :
      "Error";

    const fallback = statusFallback(status);
    const codedText = serverMessage?.match(CODED_TEXT);
    const errorCode =
      serverMessage ? serverCode ?? codedText?.[1] ?? ErrorCode.ServerMessageWithoutCode :
      legacy ? legacy.code :
      fallback.code;
    const displayMessage =
      serverMessage && codedText ? serverMessage :
      serverMessage ? formatError(serverMessage, errorCode, ref) :
      legacy ? formatError(i18n.t(legacy.key), errorCode, ref) :
      formatError(fallback.text, errorCode, ref);

    // Avoid duplicate toasts: let ChatSurface handle 404 for GET /api/Chats/:id
    const method = (options.method || 'GET').toUpperCase();
    const isChatGet404 = status === 404 && method === 'GET' && /^\/api\/Chats\/[^/]+$/.test(endpoint);
    // A 409 from a tool-call respond means another tab or the timeout got there first; the
    // caller adopts the returned status quietly.
    const isToolRespond409 = status === 409 && /\/tool-calls\/[^/]+\/respond$/.test(endpoint);
    if (!isChatGet404 && !isToolRespond409) {
      addNotification({ level, message: displayMessage });
    }
    throw new ApiError(`API call failed: ${response.status} ${response.statusText}`, response.status, endpoint, displayMessage, errorCode, ref);
  }

  return response;
}

async function apiService<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await send(endpoint, options, "application/json");

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get("content-type");
  const contentLength = response.headers.get("content-length");

  if (response.status === 200 && (contentLength === "0" || !contentType)) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

apiService.post = async <T>(endpoint: string, data: unknown): Promise<T> => {
  return apiService<T>(endpoint, {
    method: 'POST',
    body: JSON.stringify(data),
  });
};

apiService.put = async <T>(endpoint: string, data: unknown): Promise<T> => {
  return apiService<T>(endpoint, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
};

apiService.delete = async <T>(endpoint: string): Promise<T> => {
  return apiService<T>(endpoint, {
    method: 'DELETE',
  });
};

apiService.postForm = async <T>(endpoint: string, form: FormData): Promise<T> => {
  return apiService<T>(endpoint, {
    method: 'POST',
    body: form,
  });
};

apiService.getBlob = async (endpoint: string): Promise<Blob> => {
  const response = await send(endpoint, {}, "*/*");
  return response.blob();
};

/**
 * Uploads one file as multipart form data, with `fields` as form fields, and reports how much of it is sent, from 0 to 1.
 * A failure throws ApiError or CodedError without showing a toast: the caller shows it.
 */
apiService.uploadFile = async <T>(endpoint: string, file: File, onProgress: (fraction: number) => void, fields: Record<string, string> = {}): Promise<T> => {
  const token = await authService.getAccessToken();
  if (!token && !authService.isAuthenticated()) {
    throw new CodedError(ErrorCode.NotSignedIn, i18n.t("errors.notSignedIn"));
  }

  // The server reads the fields that come before the file
  const form = new FormData();
  for (const [name, value] of Object.entries(fields)) {
    form.append(name, value);
  }
  form.append("file", file, file.name);

  return new Promise<T>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", `${API_BASE_URL}${endpoint}`);
    request.setRequestHeader("Accept", "application/json");
    for (const [name, value] of Object.entries(telemetryHeaders())) {
      request.setRequestHeader(name, value);
    }
    if (token) {
      request.setRequestHeader("Authorization", `Bearer ${token}`);
    }

    request.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) onProgress(event.loaded / event.total);
    };
    request.upload.onload = () => onProgress(1);

    request.onerror = () => {
      trackError("network", { message: "The upload did not reach the server" });
      reject(new CodedError(ErrorCode.Network, i18n.t("errors.network")));
    };

    request.onload = () => {
      let body: unknown;
      try {
        body = JSON.parse(request.responseText);
      } catch {
        body = undefined;
      }

      if (request.status >= 200 && request.status < 300) {
        resolve(body as T);
        return;
      }

      const data = body as { message?: unknown; errorCode?: unknown; ref?: unknown } | undefined;
      const ref = request.getResponseHeader(REF_HEADER) || (typeof data?.ref === "string" ? data.ref : undefined);
      const fallback = statusFallback(request.status);
      const serverMessage = typeof data?.message === "string" ? data.message : undefined;
      const errorCode = serverMessage && typeof data?.errorCode === "string" ? data.errorCode : fallback.code;
      const displayMessage = serverMessage && CODED_TEXT.test(serverMessage)
        ? serverMessage
        : formatError(serverMessage ?? fallback.text, errorCode, ref);
      reject(new ApiError(`API call failed: ${request.status} ${request.statusText}`, request.status, endpoint, displayMessage, errorCode, ref));
    };

    request.send(form);
  });
};

export default apiService as typeof apiService & {
  post: <T>(endpoint: string, data: unknown) => Promise<T>;
  put: <T>(endpoint: string, data: unknown) => Promise<T>;
  delete: <T>(endpoint: string) => Promise<T>;
  postForm: <T>(endpoint: string, form: FormData) => Promise<T>;
  getBlob: (endpoint: string) => Promise<Blob>;
  uploadFile: <T>(endpoint: string, file: File, onProgress: (fraction: number) => void, fields?: Record<string, string>) => Promise<T>;
};
