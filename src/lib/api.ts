/**
 * Public Cloudflare Worker API Endpoint
 */
export const BASE_URL = "https://app.backcharge-assa.workers.dev";

/**
 * Resolves the backend API URL dynamically.
 */
export const getApiUrl = (path: string): string => {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;

  // Selalu gunakan relative path jika di browser, 
  // agar request mengarah ke Express server yang berjalan di domain yang sama.
  // Ini mencakup run.app, localhost, dan preview iframe (*.aistudio-preview.net)
  if (typeof window !== "undefined") {
    return cleanPath;
  }

  // Fallback ke BASE_URL jika dijalankan di luar browser (misal server-side)
  return `${BASE_URL}${cleanPath}`;
};



