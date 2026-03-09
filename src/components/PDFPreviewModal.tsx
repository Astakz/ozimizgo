import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, Loader2, ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';

async function ensurePdfJsLoaded(): Promise<void> {
  if (window.pdfjsLib) return;
  await new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      resolve();
    };
    script.onerror = () => reject(new Error('Failed to load PDF.js'));
    document.head.appendChild(script);
  });
}

interface PDFPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  pdfBlobUrl: string | null;
  onDownload: () => void;
  isLoading?: boolean;
}

export function PDFPreviewModal({ isOpen, onClose, pdfBlobUrl, onDownload, isLoading = false }: PDFPreviewModalProps) {
  const { t } = useTranslation();
  const [pageImages, setPageImages] = useState<string[]>([]);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function renderWithPdfJs(url: string) {
      setIsRendering(true); setRenderError(null); setPageImages([]);
      try {
        await ensurePdfJsLoaded();
        const res = await fetch(url);
        const data = await res.arrayBuffer();
        const pdf = await window.pdfjsLib.getDocument({ data }).promise;
        const images: string[] = [];
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          const page = await pdf.getPage(pageNum);
          const viewport = page.getViewport({ scale: 1.6 });
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('Canvas not supported');
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          await page.render({ canvasContext: ctx, viewport }).promise;
          images.push(canvas.toDataURL('image/png'));
        }
        if (!cancelled) setPageImages(images);
      } catch (e) {
        if (!cancelled) setRenderError(t('pdfPreview.renderError'));
      } finally {
        if (!cancelled) setIsRendering(false);
      }
    }
    if (isOpen && pdfBlobUrl && !isLoading) renderWithPdfJs(pdfBlobUrl);
    else { setPageImages([]); setRenderError(null); setIsRendering(false); }
    return () => { cancelled = true; };
  }, [isOpen, pdfBlobUrl, isLoading, t]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl w-[95vw] h-[85vh] sm:h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-4 sm:px-6 py-3 sm:py-4 border-b flex-shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <DialogTitle className="text-base sm:text-lg font-semibold">{t('pdfPreview.title')}</DialogTitle>
            <div className="flex items-center gap-2">
              <Button onClick={() => { if (pdfBlobUrl) window.open(pdfBlobUrl, '_blank', 'noopener,noreferrer'); }} variant="secondary" className="gold-button text-xs sm:text-sm flex-1 sm:flex-initial" size="sm" disabled={!pdfBlobUrl}>
                <ExternalLink className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />{t('pdfPreview.open')}
              </Button>
              <Button onClick={onDownload} className="gold-button text-xs sm:text-sm flex-1 sm:flex-initial" size="sm" disabled={!pdfBlobUrl}>
                <Download className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />{t('pdfPreview.download')}
              </Button>
            </div>
          </div>
        </DialogHeader>
        <div className="flex-1 overflow-hidden bg-muted">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 animate-spin text-primary" />
              <span className="ml-2 sm:ml-3 text-sm sm:text-base text-muted-foreground">{t('pdfPreview.generating')}</span>
            </div>
          ) : !pdfBlobUrl ? (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm sm:text-base">{t('pdfPreview.loadError')}</div>
          ) : isRendering ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 animate-spin text-primary" />
              <span className="ml-2 sm:ml-3 text-sm sm:text-base text-muted-foreground">{t('pdfPreview.loading')}</span>
            </div>
          ) : pageImages.length > 0 ? (
            <div className="h-full overflow-auto p-2 sm:p-4">
              <div className="mx-auto max-w-[900px] space-y-2 sm:space-y-4">
                {pageImages.map((src, idx) => (
                  <img key={idx} src={src} alt={`${t('pdfPreview.page')} ${idx + 1}`} loading="lazy" className="w-full h-auto rounded-md border bg-background" />
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4 sm:p-6 text-center">
              <p className="max-w-[520px] text-sm sm:text-base">{renderError ?? t('pdfPreview.fallback')}</p>
              <div className="mt-4">
                <Button onClick={() => { if (pdfBlobUrl) window.open(pdfBlobUrl, '_blank', 'noopener,noreferrer'); }} className="gold-button">
                  <ExternalLink className="h-4 w-4 mr-2" />{t('pdfPreview.openPdf')}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
