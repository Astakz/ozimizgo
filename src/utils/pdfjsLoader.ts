// PDF.js loader with worker configured for Vite
import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore - vite worker import
import PdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?worker';

// Initialize worker once
if (typeof window !== 'undefined' && !(pdfjsLib as any).GlobalWorkerOptions.workerPort) {
  (pdfjsLib as any).GlobalWorkerOptions.workerPort = new PdfWorker();
}

export { pdfjsLib };

export async function loadPdf(source: ArrayBuffer | string) {
  const task = pdfjsLib.getDocument(typeof source === 'string' ? { url: source } : { data: source });
  return await task.promise;
}

export async function renderPageToCanvas(
  pdf: any,
  pageNum: number,
  scale = 1.5,
): Promise<HTMLCanvasElement> {
  const page = await pdf.getPage(pageNum);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d')!;
  await page.render({ canvasContext: ctx, viewport }).promise;
  return canvas;
}
