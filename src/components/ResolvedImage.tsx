import React, { useState, useEffect } from "react";
import { Loader2, ImageOff, FileText, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
import { getApiUrl } from "../lib/api";

interface ResolvedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src?: string | null;
  fallbackText?: string;
}

export const ResolvedImage: React.FC<ResolvedImageProps> = ({
  src,
  fallbackText,
  alt = "Foto",
  className = "",
  loading: htmlLoading,
  ...props
}) => {
  // 1. State isLoading (default true) sebelum data Blob/URL proxy gambar siap sepenuhnya
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isImageReady, setIsImageReady] = useState<boolean>(false);
  const [objectUrl, setObjectUrl] = useState<string>("");
  const [error, setError] = useState<boolean>(false);
  const [isPdf, setIsPdf] = useState<boolean>(false);
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  useEffect(() => {
    let isMounted = true;
    let localBlobUrl: string | null = null;

    // Reset state saat src berubah
    setIsLoading(true);
    setIsImageReady(false);
    setError(false);
    setIsPdf(false);
    setZoomLevel(1);
    setObjectUrl("");

    if (!src) {
      setIsLoading(false);
      setError(true);
      return;
    }

    // A. Data URLs atau Blob URLs langsung dapat digunakan
    if (src.startsWith("data:") || src.startsWith("blob:")) {
      const pdfDetected = src.startsWith("data:application/pdf") || src.toLowerCase().includes(".pdf");
      if (isMounted) {
        setObjectUrl(src);
        setIsPdf(pdfDetected);
        setIsLoading(false);
      }
      return;
    }

    // B. Ekstraksi Google Drive file ID atau endpoint proxy aman
    let targetUrl = src;
    let driveId = "";
    if (src.includes("drive.google.com")) {
      const match = src.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || src.match(/[?&]id=([a-zA-Z0-9_-]+)/);
      if (match && match[1]) {
        driveId = match[1];
        targetUrl = `/api/files/secure/${driveId}`;
      }
    } else if (src.includes("/api/files/secure/")) {
      const parts = src.split("/api/files/secure/")[1]?.split("?")[0];
      if (parts) driveId = parts;
    }

    // C. Siapkan Header Otentikasi
    const token = localStorage.getItem("backcharge_auth_token") || localStorage.getItem("bc_auth_token") || "";
    const headers: Record<string, string> = {
      Accept: "image/*, application/pdf, */*"
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
      headers["x-auth-token"] = token;
    }
    const dbKey = typeof window !== "undefined" ? localStorage.getItem("DATABASE_SECRET_KEY") : null;
    if (dbKey) {
      headers["X-Database-Key"] = dbKey;
    }

    const fetchUrl = targetUrl.startsWith("http") ? targetUrl : getApiUrl(targetUrl);

    // D. Fetch data biner secara asinkron (Blob)
    const fetchResource = async () => {
      try {
        const response = await fetch(fetchUrl, {
          method: "GET",
          headers,
          credentials: "include"
        });

        if (response.status !== 200 || !response.ok) {
          // Fallback ke /api/file-data jika Drive ID tersedia
          if (driveId) {
            try {
              const fallbackRes = await fetch(getApiUrl(`/api/file-data?driveId=${encodeURIComponent(driveId)}`), {
                headers,
                credentials: "include"
              });
              if (fallbackRes.status === 200 && fallbackRes.ok) {
                const json = await fallbackRes.json();
                if (json.data && isMounted) {
                  setObjectUrl(json.data);
                  setIsPdf(json.mimeType === "application/pdf" || json.data.startsWith("data:application/pdf"));
                  setIsLoading(false);
                  return;
                }
              }
            } catch {}
          }

          if (isMounted) {
            setError(true);
            setIsLoading(false);
          }
          return;
        }

        const contentType = (response.headers.get("content-type") || "").toLowerCase();
        if (contentType.includes("application/json") || contentType.includes("text/html")) {
          if (isMounted) {
            setError(true);
            setIsLoading(false);
          }
          return;
        }

        const blob = await response.blob();
        if (blob.size === 0) {
          if (isMounted) {
            setError(true);
            setIsLoading(false);
          }
          return;
        }

        // Deteksi apakah berkas adalah dokumen PDF
        const isImageUrl = /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(src) || /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(alt);
        let fileIsPdf = !isImageUrl && (
          blob.type === "application/pdf" || 
          contentType.includes("application/pdf") || 
          (src || "").toLowerCase().includes(".pdf")
        );

        if (!isImageUrl && !fileIsPdf && blob.size >= 4) {
          try {
            const headBytes = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
            if (headBytes[0] === 0x25 && headBytes[1] === 0x50 && headBytes[2] === 0x44 && headBytes[3] === 0x46) {
              fileIsPdf = true;
            }
          } catch {}
        }

        // Buat Blob URL langsung dari data biner
        const createdObjUrl = URL.createObjectURL(blob);
        localBlobUrl = createdObjUrl;

        if (isMounted) {
          setObjectUrl(createdObjUrl);
          setIsPdf(fileIsPdf);
          setIsLoading(false);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(true);
          setIsLoading(false);
        }
      }
    };

    fetchResource();

    return () => {
      isMounted = false;
      if (localBlobUrl) {
        URL.revokeObjectURL(localBlobUrl);
      }
    };
  }, [src, alt]);

  // 2. Tampilkan komponen skeleton / spinner loading saat isLoading bernilai true
  if (isLoading) {
    return (
      <div 
        className={`relative flex flex-col items-center justify-center p-4 bg-slate-900/50 border border-slate-800/80 rounded-xl min-h-[100px] w-full overflow-hidden select-none ${className}`}
        aria-busy="true"
        aria-label="Memuat gambar..."
      >
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-slate-800/30 to-transparent -translate-x-full animate-[shimmer_1.6s_infinite]" />
        <Loader2 className="w-5 h-5 animate-spin text-blue-400 mb-1.5" />
        <span className="text-[11px] font-medium text-slate-300">Menyiapkan pratinjau...</span>
        <span className="text-[9px] text-slate-500 font-mono mt-0.5">Memvalidasi data berkas</span>
      </div>
    );
  }

  // Error fallback
  if (error || !objectUrl) {
    return (
      <div className={`flex flex-col items-center justify-center p-4 bg-slate-800/40 text-slate-400 rounded-xl text-center text-xs ${className}`}>
        <ImageOff className="w-5 h-5 mb-1 text-slate-400" />
        <span>{fallbackText || "Berkas tidak dapat dibuka"}</span>
      </div>
    );
  }

  // PDF Preview Card
  if (isPdf) {
    return (
      <div className={`flex flex-col items-center justify-center p-4 bg-slate-900/90 border border-slate-700/60 rounded-xl text-slate-200 text-center shadow-md select-none ${className}`}>
        <FileText className="w-9 h-9 text-rose-500 mb-1.5" />
        <span className="text-xs font-bold text-slate-200 truncate max-w-[200px]">{alt || "Dokumen PDF"}</span>
        <span className="text-[10px] text-rose-400 font-mono mt-0.5 uppercase tracking-wider">Berkas PDF Resmi</span>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col items-center group w-full">
      {/* Skeleton overlay saat elemen <img> sedang di-decode di browser */}
      {!isImageReady && (
        <div className={`flex flex-col items-center justify-center p-4 bg-slate-900/50 border border-slate-800/80 rounded-xl min-h-[100px] w-full select-none ${className}`}>
          <Loader2 className="w-5 h-5 animate-spin text-blue-400 mb-1.5" />
          <span className="text-[11px] font-medium text-slate-300">Merender gambar...</span>
        </div>
      )}

      {/* Toolbar Zoom & Resolusi Asli */}
      {isImageReady && (
        <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center space-x-1.5 bg-slate-900/80 backdrop-blur-md p-1.5 rounded-lg border border-slate-700 shadow-lg text-white">
          <button
            type="button"
            onClick={() => setZoomLevel(prev => Math.max(prev - 0.25, 0.75))}
            className="p-1 hover:bg-slate-700 rounded transition"
            title="Perkecil"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-[10px] font-mono w-10 text-center">{Math.round(zoomLevel * 100)}%</span>
          <button
            type="button"
            onClick={() => setZoomLevel(prev => Math.min(prev + 0.5, 2.5))}
            className="p-1 hover:bg-slate-700 rounded transition"
            title="Perbesar"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <div className="w-[1px] h-4 bg-slate-700 mx-0.5" />
          <button
            type="button"
            onClick={() => {
              const a = document.createElement("a");
              a.href = objectUrl;
              a.target = "_blank";
              a.rel = "noopener noreferrer";
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
            }}
            className="p-1 hover:bg-slate-700 rounded transition flex items-center space-x-1 text-[11px] font-medium px-1.5 text-blue-300"
            title="Buka Resolusi Penuh Asli"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span className="text-[10px]">HD</span>
          </button>
        </div>
      )}

      {/* Tampilan gambar penuh dengan decoding async */}
      <div className={`overflow-auto max-h-[72vh] w-full flex items-center justify-center p-2 rounded-xl ${!isImageReady ? "hidden" : "block"}`}>
        <img
          src={objectUrl}
          alt={alt}
          loading="eager"
          decoding="async"
          onLoad={() => setIsImageReady(true)}
          style={{ transform: `scale(${zoomLevel})`, transition: 'transform 0.2s ease-in-out', transformOrigin: 'center center' }}
          onError={() => {
            setError(true);
            setIsImageReady(true);
          }}
          className={`max-w-full max-h-[70vh] object-contain rounded-xl border border-slate-800 shadow-2xl transition-opacity duration-300 ${isImageReady ? "opacity-100" : "opacity-0"} ${className}`}
          {...props}
        />
      </div>
    </div>
  );
};
