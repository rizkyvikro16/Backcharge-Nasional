/**
 * Public Cloudflare Worker API Endpoint
 */
export const BASE_URL = "https://app.backcharge-assa.workers.dev";

/**
 * Resolves the backend API URL dynamically.
 */
export const getApiUrl = (path: string): string => {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;

  // Selalu gunakan relative path jika di browser dan origin valid, 
  // agar request mengarah ke Express server yang berjalan di domain yang sama.
  // Ini mencakup run.app, localhost, dan preview iframe (*.aistudio-preview.net)
  if (typeof window !== "undefined") {
    if (window.location && window.location.origin && window.location.origin !== "null" && window.location.origin !== "about:blank") {
      return cleanPath;
    }
  }

  // Fallback ke BASE_URL jika dijalankan di luar browser (misal server-side)
  return `${BASE_URL}${cleanPath}`;
};

// Helper untuk token otentikasi resmi dari server
export const getAuthToken = (): string => {
  if (typeof window !== "undefined") {
    return localStorage.getItem("backcharge_auth_token") || "";
  }
  return "";
};

export const setAuthToken = (token: string): void => {
  if (typeof window !== "undefined") {
    localStorage.setItem("backcharge_auth_token", token);
  }
};

export const clearAuthToken = (): void => {
  if (typeof window !== "undefined") {
    localStorage.removeItem("backcharge_auth_token");
    localStorage.removeItem("backcharge_session_profile");
  }
};

export const getAuthHeaders = (extraHeaders: Record<string, string> = {}, includeContentType = true): Record<string, string> => {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    ...extraHeaders
  };
  if (includeContentType && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
    headers["x-auth-token"] = token;
  }
  const dbKey = typeof window !== "undefined" ? localStorage.getItem("DATABASE_SECRET_KEY") : null;
  if (dbKey) {
    headers["X-Database-Key"] = dbKey;
  }
  return headers;
};

