import { PDFDocument } from 'pdf-lib';
import type { RenderedPage } from './documentLoader';
import type { PlacedSig } from '@/components/documents/PlacedSignature';

// Rasterize a single page + its signatures into a composed canvas
export async function composePage(page: RenderedPage, sigs: PlacedSig[]): Promise<HTMLCanvasElement> {
  const out = document.createElement('canvas');
  out.width = page.width;
  out.height = page.height;
  const ctx = out.getContext('2d')!;
  ctx.drawImage(page.canvas, 0, 0);
  for (const s of sigs.filter((x) => x.pageNum === page.pageNum)) {
    const img = new Image();
    await new Promise<void>((r, j) => { img.onload = () => r(); img.onerror = j; img.src = s.dataUrl; });
    ctx.save();
    ctx.translate(s.x + s.w / 2, s.y + s.h / 2);
    ctx.rotate((s.rotation * Math.PI) / 180);
    ctx.drawImage(img, -s.w / 2, -s.h / 2, s.w, s.h);
    ctx.restore();
  }
  return out;
}

export async function exportToPdf(pages: RenderedPage[], sigs: PlacedSig[]): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  for (const p of pages) {
    const composed = await composePage(p, sigs);
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
  return await new Promise<Blob>((r) => c.toBlob((b) => r(b!), mime, 0.95));
}

export function downloadBlob(data: Uint8Array | Blob, filename: string, mime: string) {
  const blob = data instanceof Blob ? data : new Blob([new Uint8Array(data)], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
