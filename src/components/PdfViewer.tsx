import React, { useState, useEffect, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { Loader2, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Download, ExternalLink, FileText, AlertCircle } from 'lucide-react';

// Configure PDF.js worker
if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
}

interface PdfViewerProps {
  data: Blob | ArrayBuffer | string;
  title?: string;
  className?: string;
}

export const PdfViewer: React.FC<PdfViewerProps> = ({
  data,
  title = 'Dokumen PDF',
  className = ''
}) => {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.25);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pdfDocRef = useRef<any>(null);
  const renderTaskRef = useRef<any>(null);

  // Load PDF document
  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);
    setPageNumber(1);

    const loadPdf = async () => {
      try {
        let pdfData: any;

        if (data instanceof Blob) {
          pdfData = await data.arrayBuffer();
        } else if (data instanceof ArrayBuffer) {
          pdfData = data;
        } else if (typeof data === 'string' && data.startsWith('data:')) {
          // Decode base64 to binary
          const base64Clean = data.split(',')[1] || data;
          const binaryString = window.atob(base64Clean);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          pdfData = bytes.buffer;
        } else {
          pdfData = data;
        }

        const loadingTask = pdfjsLib.getDocument(
          typeof pdfData === 'string' ? { url: pdfData } : { data: pdfData }
        );

        const pdf = await loadingTask.promise;
        if (isMounted) {
          pdfDocRef.current = pdf;
          setNumPages(pdf.numPages);
          setLoading(false);
        }
      } catch (err: any) {
        console.error('[PdfViewer] Gagal memuat dokumen PDF:', err);
        if (isMounted) {
          setError(err?.message || 'Gagal memproses dokumen PDF');
          setLoading(false);
        }
      }
    };

    loadPdf();

    return () => {
      isMounted = false;
      if (pdfDocRef.current) {
        try {
          pdfDocRef.current.destroy();
        } catch {}
      }
    };
  }, [data]);

  // Render current page onto canvas
  useEffect(() => {
    if (!pdfDocRef.current || pageNumber < 1 || loading) return;

    let isMounted = true;

    const renderPage = async () => {
      try {
        // Cancel previous rendering if running
        if (renderTaskRef.current) {
          try {
            renderTaskRef.current.cancel();
          } catch {}
        }

        const page = await pdfDocRef.current.getPage(pageNumber);
        if (!isMounted || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        if (!context) return;

        const viewport = page.getViewport({ scale });
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
          canvasContext: context,
          viewport: viewport
        };

        const renderTask = page.render(renderContext);
        renderTaskRef.current = renderTask;
        await renderTask.promise;
      } catch (err: any) {
        if (err?.name !== 'RenderingCancelledException') {
          console.warn('[PdfViewer] Halaman render notice:', err?.message);
        }
      }
    };

    renderPage();

    return () => {
      isMounted = false;
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {}
      }
    };
  }, [pageNumber, scale, loading]);

  const handlePrevPage = () => {
    setPageNumber(prev => Math.max(prev - 1, 1));
  };

  const handleNextPage = () => {
    setPageNumber(prev => Math.min(prev + 1, numPages));
  };

  const handleZoomIn = () => {
    setScale(prev => Math.min(prev + 0.25, 2.5));
  };

  const handleZoomOut = () => {
    setScale(prev => Math.max(prev - 0.25, 0.75));
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-slate-900/90 rounded-2xl border border-slate-800 text-slate-300 shadow-2xl">
        <Loader2 className="w-9 h-9 animate-spin text-blue-500 mb-3" />
        <p className="text-xs font-bold text-slate-200">Menyiapkan Pratinjau Dokumen PDF...</p>
        <span className="text-[10px] text-slate-400 mt-1 font-mono truncate max-w-xs">{title}</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-slate-900 border border-slate-800 rounded-2xl text-slate-300 text-center max-w-md shadow-2xl">
        <div className="w-12 h-12 bg-amber-500/10 rounded-full flex items-center justify-center text-amber-500 mb-3">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h4 className="text-sm font-bold text-slate-200 mb-1">Pratinjau PDF Terkendala</h4>
        <p className="text-[11px] text-slate-400 mb-4">{error}</p>
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center justify-center w-full max-w-4xl font-sans ${className}`}>
      {/* PDF Controls Toolbar */}
      <div className="w-full flex flex-wrap items-center justify-between bg-slate-900/90 border border-slate-800 rounded-t-xl px-4 py-2.5 backdrop-blur-md shadow-lg text-slate-200 text-xs select-none gap-2">
        <div className="flex items-center space-x-2">
          <FileText className="w-4 h-4 text-rose-400" />
          <span className="font-bold truncate max-w-[200px] md:max-w-xs">{title}</span>
        </div>

        {/* Paging & Zoom */}
        <div className="flex items-center space-x-3">
          {numPages > 1 && (
            <div className="flex items-center space-x-1 bg-slate-800/80 px-2 py-1 rounded-lg border border-slate-700">
              <button
                type="button"
                onClick={handlePrevPage}
                disabled={pageNumber <= 1}
                className="p-1 hover:text-white disabled:opacity-30 cursor-pointer"
                title="Halaman Sebelumnya"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-[11px] font-mono px-1">
                {pageNumber} / {numPages}
              </span>
              <button
                type="button"
                onClick={handleNextPage}
                disabled={pageNumber >= numPages}
                className="p-1 hover:text-white disabled:opacity-30 cursor-pointer"
                title="Halaman Selanjutnya"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          <div className="flex items-center space-x-1 bg-slate-800/80 px-2 py-1 rounded-lg border border-slate-700">
            <button
              type="button"
              onClick={handleZoomOut}
              disabled={scale <= 0.75}
              className="p-1 hover:text-white disabled:opacity-30 cursor-pointer"
              title="Perkecil"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] font-mono w-10 text-center">
              {Math.round(scale * 100)}%
            </span>
            <button
              type="button"
              onClick={handleZoomIn}
              disabled={scale >= 2.5}
              className="p-1 hover:text-white disabled:opacity-30 cursor-pointer"
              title="Perbesar"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Canvas Canvas Area */}
      <div className="w-full max-h-[70vh] overflow-auto bg-slate-950 flex items-center justify-center p-4 rounded-b-xl border border-t-0 border-slate-800 shadow-2xl">
        <canvas
          ref={canvasRef}
          className="rounded shadow-2xl max-w-full h-auto bg-white"
        />
      </div>
    </div>
  );
};
