/**
 * Resolves the backend API URL dynamically.
 */
export const getApiUrl = (path: string): string => {
  const hostname = window.location.hostname;
  const isCloudflare = hostname.includes("pages.dev") || hostname.includes("workers.dev");
  
  let base = "";
  if (isCloudflare) {
    // Ubah URL di bawah ini dengan URL Cloudflare Worker API D1 Anda
    base = "https://api.backcharge-assa.workers.dev";
  }

  const cleanBase = base.replace(/\/+$/, "");
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return cleanBase ? `${cleanBase}${cleanPath}` : cleanPath;
};
