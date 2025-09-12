import authService from "./authService";

// const API_BASE_URL = "https://localhost:7254";
const API_BASE_URL = "";

async function apiService<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await authService.getAccessToken();

  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  headers.set("Content-Type", "application/json");

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  } else {
    // If no token and user is not authenticated, throw an error to prevent unauthorized API calls
    if (!authService.isAuthenticated()) {
      throw new Error(`Authentication required for API call to ${endpoint}`);
    }
    console.log("No token found, proceeding without authorization header.");
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    // If we get a 401 and the user should be authenticated, it might be a token issue
    if (response.status === 401 && authService.isAuthenticated()) {
      console.warn("Received 401 despite being authenticated. Token may have expired.");
    }
    throw new Error(`API call failed: ${response.status} ${response.statusText}`);
  }

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

apiService.post = async <T>(endpoint: string, data: any): Promise<T> => {
  return apiService<T>(endpoint, {
    method: 'POST',
    body: JSON.stringify(data),
  });
};

apiService.put = async <T>(endpoint: string, data: any): Promise<T> => {
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

export default apiService as typeof apiService & {
  post: <T>(endpoint: string, data: any) => Promise<T>;
  put: <T>(endpoint: string, data: any) => Promise<T>;
  delete: <T>(endpoint: string) => Promise<T>;
};
