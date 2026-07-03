import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { SignField, FieldValueMap } from '@/types/sign';

// Embed field values and signature images into the original PDF, append audit page.
// Fields carry x, y, w, h in PDF-page space (points), page index (1-based).
export async function finalizeSignedPdf(
  originalBytes: ArrayBuffer,
  fields: SignField[],
  values: FieldValueMap,
  audit: {
    documentId: string;
    signerName: string;
    signedAt: string;
    openedAt?: string;
    ip?: string;
    userAgent?: string;
  },
): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(originalBytes);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pages = pdf.getPages();

  for (const f of fields) {
    const page = pages[f.page - 1];
    if (!page) continue;
    const val = values[f.id];
    if (val == null || val === '') continue;

    const pageHeight = page.getHeight();
    // Convert top-left (y from top) to bottom-left (pdf-lib uses bottom-left)
    const x = f.x;
    const y = pageHeight - f.y - f.h;

    if (f.type === 'signature' && typeof val === 'string' && val.startsWith('data:image/png')) {
      const base64 = val.split(',')[1];
      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      const img = await pdf.embedPng(bytes);
      const dims = img.scaleToFit(f.w, f.h);
      page.drawImage(img, {
        x: x + (f.w - dims.width) / 2,
        y: y + (f.h - dims.height) / 2,
        width: dims.width,
        height: dims.height,
      });
    } else if (f.type === 'checkbox') {
      if (val) {
        page.drawRectangle({ x, y, width: f.w, height: f.h, borderColor: rgb(0, 0, 0), borderWidth: 1 });
        page.drawText('X', { x: x + 3, y: y + 3, size: f.h - 6, font: fontBold, color: rgb(0, 0, 0) });
      }
    } else {
      // text-like: name, initials, date, iin, email, phone, text
      const size = Math.min(f.h * 0.6, 14);
      const text = String(val);
      page.drawText(text, {
        x: x + 4,
        y: y + (f.h - size) / 2,
        size,
        font,
        color: rgb(0.05, 0.1, 0.25),
        maxWidth: f.w - 8,
      });
    }
  }

  // Audit page
  const audP = pdf.addPage();
  const { width, height } = audP.getSize();
  let cursor = height - 60;
  audP.drawText('Certificate of Completion', {
    x: 50, y: cursor, size: 22, font: fontBold, color: rgb(0.05, 0.15, 0.35),
  });
  cursor -= 12;
  audP.drawLine({
    start: { x: 50, y: cursor }, end: { x: width - 50, y: cursor },
    thickness: 1.5, color: rgb(0.83, 0.68, 0.21),
  });
  cursor -= 30;

  const lines: [string, string][] = [
    ['Document ID', audit.documentId],
    ['Signer', audit.signerName || '—'],
    ['Signed at', new Date(audit.signedAt).toLocaleString()],
    ['Opened at', audit.openedAt ? new Date(audit.openedAt).toLocaleString() : '—'],
    ['IP address', audit.ip || '—'],
    ['User agent', (audit.userAgent || '—').slice(0, 90)],
    ['Total fields signed', String(fields.length)],
  ];
  for (const [k, v] of lines) {
    audP.drawText(k, { x: 50, y: cursor, size: 11, font: fontBold, color: rgb(0.3, 0.3, 0.3) });
    audP.drawText(v, { x: 200, y: cursor, size: 11, font, color: rgb(0.1, 0.1, 0.15), maxWidth: width - 260 });
    cursor -= 22;
  }

  cursor -= 20;
  audP.drawText('This certificate is generated automatically and confirms the electronic signing of the document.', {
    x: 50, y: cursor, size: 9, font, color: rgb(0.5, 0.5, 0.55), maxWidth: width - 100,
  });

  return await pdf.save();
}

export function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
