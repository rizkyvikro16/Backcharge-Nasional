/**
 * Resolves the backend API URL dynamically.
 * If running on a static hosting platform (like Cloudflare Pages), it automatically
 * forwards requests to the stable Cloud Run container backend.
 */
export const getApiUrl = (path: string): string => {
  const isCloudflarePages = window.location.hostname.includes("pages.dev");
  const base = isCloudflarePages 
    ? "https://ais-pre-d2jxy6lmt46fvtybeg4n24-563947435575.asia-southeast1.run.app"
    : "";
  return `${base}${path}`;
};
