import authService from "./authService";
import { addNotification } from "./notificationService";
import type { NotifyLevel } from "../types/notification";

// const API_BASE_URL = "https://localhost:7254";
const API_BASE_URL = "";

/** A non-2xx response. The toast has already been shown by the time this is thrown. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly endpoint: string
  ) {
    super(message);
    this.name = "ApiError";
  }
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
  if (!(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  } else if (!authService.isAuthenticated()) {
    throw new Error(`Authentication required for API call to ${endpoint}`);
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });
  } catch (err) {
    addNotification({ level: "Error", message: "Network error. Please check your connection and try again." });
    throw err;
  }

  if (!response.ok) {

    let serverMessage: string | undefined;
    try {
      const ct = response.headers.get("content-type") || "";
      if (ct.includes("application/json")) {
        const data = await response.json();
        serverMessage = typeof data === "string" ? data : (data?.message || data?.error);
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

    const fallback =
      status === 401 || status === 403 ? "You are not authorized to perform this action." :
      status === 404 ? "Resource not found." :
      status === 429 ? "Rate limit reached. Please try again." :
      status >= 500 ? "Internal server error. Please try again." :
      `Request failed (${status}).`;

    // Avoid duplicate toasts: let ChatSurface handle 404 for GET /api/Chats/:id
    const method = (options.method || 'GET').toUpperCase();
    const isChatGet404 = status === 404 && method === 'GET' && /^\/api\/Chats\/[^/]+$/.test(endpoint);
    // A 409 from a tool-call respond means another tab or the timeout got there first; the
    // caller adopts the returned status quietly.
    const isToolRespond409 = status === 409 && /\/tool-calls\/[^/]+\/respond$/.test(endpoint);
    if (!isChatGet404 && !isToolRespond409) {
      addNotification({ level, message: serverMessage?.toString() || fallback });
    }
    throw new ApiError(`API call failed: ${response.status} ${response.statusText}`, response.status, endpoint);
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

export default apiService as typeof apiService & {
  post: <T>(endpoint: string, data: unknown) => Promise<T>;
  put: <T>(endpoint: string, data: unknown) => Promise<T>;
  delete: <T>(endpoint: string) => Promise<T>;
  postForm: <T>(endpoint: string, form: FormData) => Promise<T>;
  getBlob: (endpoint: string) => Promise<Blob>;
};
