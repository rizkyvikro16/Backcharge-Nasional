import { getApiUrl, getAuthHeaders } from "./api";

// In-memory cache for resolved data URLs to prevent duplicate network fetches
const resolvedUrlCache = new Map<string, string>();
const pendingPromises = new Map<string, Promise<string>>();

/**
 * Ekstraksi ID File Google Drive secara ketat menggunakan regex
 */
export const extractDriveId = (url: string | null | undefined): string | null => {
  if (!url) return null;
  const trimmed = url.trim();
  const match = trimmed.match(/\/d\/([a-zA-Z0-9_-]+)/) || 
                trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/) ||
                trimmed.match(/\/api\/files\/secure\/([a-zA-Z0-9_-]+)/);
  if (match) return match[1];
  // If string is a raw Google Drive alphanumeric ID
  if (/^[a-zA-Z0-9_-]{25,50}$/.test(trimmed)) {
    return trimmed;
  }
  return null;
};

/**
 * Mengonversi URL mentah Google Drive menjadi endpoint secure proxy backend
 */
export const toSecureProxyUrl = (url: string | null | undefined): string => {
  if (!url) return "";
  if (url.startsWith("data:") || url.startsWith("blob:")) return url;

  if (url.includes("drive.google.com") || url.includes("/d/")) {
    const driveId = extractDriveId(url);
    if (driveId) {
      return `/api/files/secure/${driveId}`;
    }
  }

  return url;
};

/**
 * Dynamically resolves a file URL.
 * - Base64 (data:...) and Blob (blob:...) are used directly.
 * - Google Drive links (drive.google.com) are intercepted and resolved through secure proxy /api/files/secure/:fileId
 * - Relative paths (/uploads/... or /api/files/secure/...) are authenticated with the backcharge session token.
 */
export async function resolveFileUrl(url: string | null | undefined): Promise<string> {
  if (!url || typeof url !== "string") return "";

  // Base64 or blob URLs can be used directly in memory
  if (url.startsWith("data:") || url.startsWith("blob:")) {
    return url;
  }

  // Check cache
  if (resolvedUrlCache.has(url)) {
    return resolvedUrlCache.get(url)!;
  }

  // Extract Google Drive ID if present and convert to backend secure proxy URL
  let targetUrl = toSecureProxyUrl(url);

  const token = localStorage.getItem("backcharge_auth_token") || localStorage.getItem("bc_auth_token") || "";

  // Build authenticated proxy URL
  let finalUrl = targetUrl;
  if (targetUrl.startsWith("/api/") || targetUrl.startsWith("/uploads/") || !targetUrl.startsWith("http")) {
    const cleanPath = targetUrl.startsWith("/") ? targetUrl : `/${targetUrl}`;
    finalUrl = getApiUrl(`${cleanPath}${cleanPath.includes("?") ? "&" : "?"}token=${encodeURIComponent(token)}`);
  } else if (targetUrl.includes("/api/files/secure/") || targetUrl.includes("/api/files/")) {
    finalUrl = `${targetUrl}${targetUrl.includes("?") ? "&" : "?"}token=${encodeURIComponent(token)}`;
  } else if (targetUrl.startsWith("http://") || targetUrl.startsWith("https://")) {
    if (!targetUrl.includes("drive.google.com")) {
      finalUrl = targetUrl;
    }
  }

  resolvedUrlCache.set(url, finalUrl);
  return finalUrl;
}

/**
 * Opens a resolved file or image URL safely in a new browser window/tab for viewing.
 * Prevents forced file downloads by navigating Google Drive files directly to Google's
 * interactive web document viewer (https://drive.google.com/file/d/{id}/view) and
 * serving internal/proxy files with explicit inline disposition.
 */
export async function openFileInNewTab(url: string, title?: string): Promise<void> {
  if (!url || url.startsWith("MOCK_")) return;

  try {
    // 1. If it has a Google Drive File ID, open Google's native interactive document viewer
    // This allows full-page viewing, zooming, rotation, and reading without triggering a file download.
    const driveId = extractDriveId(url);
    if (driveId) {
      const viewerUrl = `https://drive.google.com/file/d/${encodeURIComponent(driveId)}/view`;
      const a = document.createElement("a");
      a.href = viewerUrl;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return;
    }

    // 2. Data URLs or existing Blob URLs
    if (url.startsWith("data:") || url.startsWith("blob:")) {
      const a = document.createElement("a");
      a.href = url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return;
    }

    // 3. Resolve authenticated secure proxy URL with inline viewing parameters
    const resolved = await resolveFileUrl(url);
    const targetUrl = resolved.startsWith("http") ? resolved : getApiUrl(resolved);
    const separator = targetUrl.includes("?") ? "&" : "?";
    const inlineUrl = `${targetUrl}${separator}inline=1&name=${encodeURIComponent(title || "document")}`;

    // 4. Open directly in new tab cleanly
    const a = document.createElement("a");
    a.href = inlineUrl;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch (err) {
    console.error("[openFileInNewTab] Gagal membuka berkas di tab baru:", err);
  }
}
