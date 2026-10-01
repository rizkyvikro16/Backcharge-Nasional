import React, { useState, useEffect } from "react";
import { resolveFileUrl } from "../lib/fileResolver";
import { Loader2, ImageOff } from "lucide-react";

interface ResolvedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src?: string | null;
  fallbackText?: string;
}

export const ResolvedImage: React.FC<ResolvedImageProps> = ({
  src,
  fallbackText,
  alt = "Foto",
  className = "",
  ...props
}) => {
  const [resolvedSrc, setResolvedSrc] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    if (!src) {
      setResolvedSrc("");
      setLoading(false);
      setError(true);
      return;
    }

    if (src.startsWith("data:") || src.startsWith("blob:") || src.startsWith("http://") || src.startsWith("https://")) {
      setResolvedSrc(src);
      setLoading(false);
      setError(false);
      return;
    }

    setLoading(true);
    setError(false);
    resolveFileUrl(src)
      .then((res) => {
        if (isMounted) {
          if (res) {
            setResolvedSrc(res);
            setError(false);
          } else {
            setError(true);
          }
          setLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setError(true);
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [src]);

  if (loading) {
    return (
      <div className={`flex items-center justify-center p-4 bg-slate-800/50 text-slate-400 rounded-xl min-h-[100px] ${className}`}>
        <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
      </div>
    );
  }

  if (error || !resolvedSrc) {
    return (
      <div className={`flex flex-col items-center justify-center p-4 bg-slate-800/40 text-slate-400 rounded-xl text-center text-xs ${className}`}>
        <ImageOff className="w-5 h-5 mb-1 text-slate-400" />
        <span>{fallbackText || "Gambar tidak dapat dibuka"}</span>
      </div>
    );
  }

  return (
    <img
      src={resolvedSrc}
      alt={alt}
      onError={() => setError(true)}
      className={className}
      {...props}
    />
  );
};
