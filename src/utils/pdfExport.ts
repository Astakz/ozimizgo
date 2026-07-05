import { PDFDocument } from 'pdf-lib';
import type { RenderedPage } from './documentLoader';
import type { PlacedSig } from '@/components/documents/PlacedSignature';

// Oversampling factor for signature rasterization (relative to natural signature pixel size on page canvas).
// Higher = crisper in exported PDF. 4x yields near-vector print quality.
const SIG_OVERSAMPLE = 4;

async function loadImage(src: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.decoding = 'sync' as any;
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('image load failed'));
    img.src = src;
  });
  return img;
}

/**
 * Rasterize a signature image (SVG or PNG) at a target device pixel size.
 * SVG sources are rendered by the browser vector-crisp at the exact target size.
 */
async function rasterizeSignature(dataUrl: string, targetW: number, targetH: number): Promise<HTMLCanvasElement> {
  const img = await loadImage(dataUrl);
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(targetW));
  c.height = Math.max(1, Math.round(targetH));
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.clearRect(0, 0, c.width, c.height);
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return c;
}

// Rasterize a single page + its signatures into a composed canvas at page.canvas resolution.
export async function composePage(page: RenderedPage, sigs: PlacedSig[]): Promise<HTMLCanvasElement> {
  const out = document.createElement('canvas');
  out.width = page.width;
  out.height = page.height;
  const ctx = out.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(page.canvas, 0, 0);
  for (const s of sigs.filter((x) => x.pageNum === page.pageNum)) {
    // Rasterize signature at high DPI, then draw at final size — preserves crisp edges even after PDF encoding.
    const hiW = Math.max(1, Math.round(s.w * SIG_OVERSAMPLE));
    const hiH = Math.max(1, Math.round(s.h * SIG_OVERSAMPLE));
    const sigCanvas = await rasterizeSignature(s.dataUrl, hiW, hiH);
    ctx.save();
    ctx.translate(s.x + s.w / 2, s.y + s.h / 2);
    ctx.rotate((s.rotation * Math.PI) / 180);
    ctx.drawImage(sigCanvas, -s.w / 2, -s.h / 2, s.w, s.h);
    ctx.restore();
  }
  return out;
}

export async function exportToPdf(pages: RenderedPage[], sigs: PlacedSig[]): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  for (const p of pages) {
    const composed = await composePage(p, sigs);
    // Use PNG (lossless) to preserve signature edge quality — no JPEG compression artifacts.
    const dataUrl = composed.toDataURL('image/png');
    const bytes = Uint8Array.from(atob(dataUrl.split(',')[1]), (c) => c.charCodeAt(0));
    const img = await pdf.embedPng(bytes);
    const page = pdf.addPage([p.width, p.height]);
    page.drawImage(img, { x: 0, y: 0, width: p.width, height: p.height });
  }
  return pdf.save();
}

export async function exportPageToImage(page: RenderedPage, sigs: PlacedSig[], mime: 'image/png' | 'image/jpeg' = 'image/png'): Promise<Blob> {
  const c = await composePage(page, sigs);
  return await new Promise<Blob>((r) => c.toBlob((b) => r(b!), mime, 0.98));
}

export function downloadBlob(data: Uint8Array | Blob, filename: string, mime: string) {
  const blob = data instanceof Blob ? data : new Blob([new Uint8Array(data)], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
