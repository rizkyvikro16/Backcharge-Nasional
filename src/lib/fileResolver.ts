import { getApiUrl } from "./api";

// In-memory cache for resolved data URLs to prevent duplicate network fetches
const resolvedUrlCache = new Map<string, string>();
const pendingPromises = new Map<string, Promise<string>>();

/**
 * Dynamically resolves a file URL.
 * If url is base64 (data:...) or external (http...), returns as-is.
 * If url is relative (/uploads/...), fetches /api/file-data?path=...
 * to retrieve the data URL (data:image/jpeg;base64,...).
 * This completely bypasses iframe/cookie check 302 redirects in AI Studio.
 */
export async function resolveFileUrl(url: string | null | undefined): Promise<string> {
  if (!url || typeof url !== "string") return "";

  // Base64, blob, or external web URLs can be used directly
  if (url.startsWith("data:") || url.startsWith("blob:") || url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  // Check cache
  if (resolvedUrlCache.has(url)) {
    return resolvedUrlCache.get(url)!;
  }

  // Deduplicate in-flight requests
  if (pendingPromises.has(url)) {
    return pendingPromises.get(url)!;
  }

  const fetchPromise = (async () => {
    try {
      const apiUrl = getApiUrl(`/api/file-data?path=${encodeURIComponent(url)}`);
      const res = await fetch(apiUrl);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          resolvedUrlCache.set(url, json.data);
          return json.data as string;
        }
      }
    } catch (err) {
      console.warn("[FileResolver] Failed to resolve file data:", url, err);
    }

    const fallback = getApiUrl(url);
    resolvedUrlCache.set(url, fallback);
    return fallback;
  })();

  pendingPromises.set(url, fetchPromise);
  try {
    const result = await fetchPromise;
    return result;
  } finally {
    pendingPromises.delete(url);
  }
}

/**
 * Opens a resolved file or image URL safely in a new browser window/tab.
 */
export async function openFileInNewTab(url: string, title?: string): Promise<void> {
  if (!url) return;
  const resolved = await resolveFileUrl(url);

  if (resolved.startsWith("data:")) {
    const isPdf = resolved.startsWith("data:application/pdf");
    const newWin = window.open("", "_blank");
    if (newWin) {
      newWin.document.write(`
        <!DOCTYPE html>
        <html lang="id">
          <head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <title>${title || "Pratinjau Dokumen"}</title>
            <style>
              body {
                margin: 0;
                padding: 0;
                background-color: #0f172a;
                color: #ffffff;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
                font-family: system-ui, -apple-system, sans-serif;
              }
              .container {
                max-width: 95vw;
                max-height: 95vh;
                display: flex;
                justify-content: center;
                align-items: center;
              }
              img {
                max-width: 100%;
                max-height: 92vh;
                object-fit: contain;
                border-radius: 8px;
                box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5);
              }
              iframe {
                width: 90vw;
                height: 90vh;
                border: none;
                border-radius: 8px;
              }
            </style>
          </head>
          <body>
            <div class="container">
              ${
                isPdf
                  ? `<iframe src="${resolved}" title="${title || "PDF Viewer"}"></iframe>`
                  : `<img src="${resolved}" alt="${title || "Gambar Dokumen"}" />`
              }
            </div>
          </body>
        </html>
      `);
      newWin.document.close();
    }
  } else {
    window.open(resolved, "_blank");
  }
}
