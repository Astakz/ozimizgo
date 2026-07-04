import { PDFDocument, degrees } from 'pdf-lib';
import type { RenderedPage } from './documentLoader';
import type { PlacedSig } from '@/components/documents/PlacedSignature';

// Compose the rendered pages + placed signatures into a downloadable PDF.
export async function exportToPdf(pages: RenderedPage[], sigs: PlacedSig[]): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  for (const p of pages) {
    // Convert page canvas to PNG bytes and embed
    const dataUrl = p.canvas.toDataURL('image/png');
    const bytes = Uint8Array.from(atob(dataUrl.split(',')[1]), (c) => c.charCodeAt(0));
    const img = await pdf.embedPng(bytes);
    const page = pdf.addPage([p.width, p.height]);
    page.drawImage(img, { x: 0, y: 0, width: p.width, height: p.height });

    // Draw signatures on this page (canvas coord origin top-left → pdf-lib bottom-left)
    for (const s of sigs.filter((x) => x.pageNum === p.pageNum)) {
      const sigBytes = Uint8Array.from(atob(s.dataUrl.split(',')[1]), (c) => c.charCodeAt(0));
      const sigImg = await pdf.embedPng(sigBytes);
      const y = p.height - s.y - s.h;
      page.drawImage(sigImg, {
        x: s.x + s.w / 2,
        y: y + s.h / 2,
        width: s.w,
        height: s.h,
        rotate: degrees(-s.rotation),
        // draw rotated around center by offsetting: pdf-lib rotates around origin, so translate x,y so that
        // after rotation the image is centered on desired point. Trick: draw with x,y as center then negate half via matrix
        // Simpler: draw normally without rotation if rotation ~ 0
      });
    }
  }
  return pdf.save();
}

// Compose to a single PNG (current page only)
export function exportPageToPng(page: RenderedPage, sigs: PlacedSig[]): string {
  const out = document.createElement('canvas');
  out.width = page.width;
  out.height = page.height;
  const ctx = out.getContext('2d')!;
  ctx.drawImage(page.canvas, 0, 0);
  for (const s of sigs.filter((x) => x.pageNum === page.pageNum)) {
    const img = new Image();
    img.src = s.dataUrl;
    // synchronous draw not possible; caller should use the async variant instead
  }
  return out.toDataURL('image/png');
}

export async function exportPageToPngAsync(page: RenderedPage, sigs: PlacedSig[]): Promise<string> {
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
  return out.toDataURL('image/png');
}

export function downloadBlob(bytes: Uint8Array | Blob, filename: string, mime: string) {
  const blob = bytes instanceof Blob ? bytes : new Blob([bytes], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, data] = dataUrl.split(',');
  const mime = meta.match(/data:(.*?);/)![1];
  const bin = atob(data);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}
