/**
 * Resolves the backend API URL dynamically.
 * Always returns relative path for clean routing on both Express and Cloudflare Workers/Pages.
 */
export const getApiUrl = (path: string): string => {
  return path.startsWith("/") ? path : `/${path}`;
};

