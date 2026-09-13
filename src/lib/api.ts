/**
 * Resolves the backend API URL dynamically.
 */
export const getApiUrl = (path: string): string => {
  const hostname = window.location.hostname;
  const cleanPath = path.startsWith("/") ? path : `/${path}`;

  // Direct relative path if running on the worker domain itself or local environment
  if (hostname.includes("app.backcharge-assa.workers.dev") || (!hostname.includes("pages.dev") && !hostname.includes("workers.dev"))) {
    return cleanPath;
  }
  
  // Default API Worker URL for Cloudflare Pages / external clients
  const base = "https://app.backcharge-assa.workers.dev";
  const cleanBase = base.replace(/\/+$/, "");
  return `${cleanBase}${cleanPath}`;
};
