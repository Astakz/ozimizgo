// Universal document loader: converts uploaded file into an array of rendered pages (canvas + natural size).
// Supports: PDF, JPG/JPEG/PNG, DOCX (mammoth → HTML → canvas), XLSX (SheetJS → HTML → canvas).
import { loadPdf } from './pdfjsLoader';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';

export interface RenderedPage {
  pageNum: number;
  canvas: HTMLCanvasElement;
  width: number;   // natural (canvas pixel) width
  height: number;
}

export type DocKind = 'pdf' | 'image' | 'docx' | 'xlsx' | 'unknown';

export function detectKind(file: File): DocKind {
  const name = file.name.toLowerCase();
  if (file.type === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
  if (file.type.startsWith('image/') || /\.(jpe?g|png)$/i.test(name)) return 'image';
  if (name.endsWith('.docx') || name.endsWith('.doc')) return 'docx';
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) return 'xlsx';
  return 'unknown';
}

const RENDER_SCALE = 2.2; // PDF render scale — higher = crisper export (~200dpi)
const A4_W = 794;         // ~96dpi A4 width in px
const A4_H = 1123;        // ~96dpi A4 height in px

export async function renderDocument(file: File): Promise<RenderedPage[]> {
  const kind = detectKind(file);
  if (kind === 'pdf') return renderPdf(file);
  if (kind === 'image') return renderImage(file);
  if (kind === 'docx') return renderDocx(file);
  if (kind === 'xlsx') return renderXlsx(file);
  throw new Error('Unsupported file type');
}

async function renderPdf(file: File): Promise<RenderedPage[]> {
  const buf = await file.arrayBuffer();
  const pdf = await loadPdf(buf.slice(0));
  const out: RenderedPage[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const vp = page.getViewport({ scale: RENDER_SCALE });
    const canvas = document.createElement('canvas');
    canvas.width = vp.width;
    canvas.height = vp.height;
    const ctx = canvas.getContext('2d')!;
    await page.render({ canvas, canvasContext: ctx, viewport: vp } as any).promise;
    out.push({ pageNum: i, canvas, width: canvas.width, height: canvas.height });
  }
  return out;
}

async function renderImage(file: File): Promise<RenderedPage[]> {
  const url = URL.createObjectURL(file);
  const img = new Image();
  await new Promise<void>((r, j) => { img.onload = () => r(); img.onerror = j; img.src = url; });
  const maxW = 1600;
  const scale = Math.min(1, maxW / img.width);
  const canvas = document.createElement('canvas');
  canvas.width = img.width * scale;
  canvas.height = img.height * scale;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  URL.revokeObjectURL(url);
  return [{ pageNum: 1, canvas, width: canvas.width, height: canvas.height }];
}

// DOCX → HTML → paginated canvas
async function renderDocx(file: File): Promise<RenderedPage[]> {
  const buf = await file.arrayBuffer();
  const { value: html } = await mammoth.convertToHtml({ arrayBuffer: buf });
  return htmlToPagedCanvases(`
    <div style="padding:60px 70px; font-family: Georgia, 'Times New Roman', serif; font-size:14px; line-height:1.6; color:#111;">
      ${html}
    </div>
  `);
}

// XLSX → HTML (each sheet = its own set of pages)
async function renderXlsx(file: File): Promise<RenderedPage[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const parts: string[] = [];
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    const html = XLSX.utils.sheet_to_html(ws, { header: `<h2 style="font-family:Inter,sans-serif;margin:0 0 12px">${name}</h2>` });
    parts.push(`<div style="padding:40px 50px; font-family: Inter, Arial, sans-serif; font-size:12px; color:#111;">${html}</div>`);
  }
  return htmlToPagedCanvases(parts.join('<div style="page-break-before:always"></div>'));
}

// Render arbitrary HTML into A4-sized canvases by offscreen mounting and clipping.
async function htmlToPagedCanvases(html: string): Promise<RenderedPage[]> {
  const holder = document.createElement('div');
  holder.style.cssText = `position:fixed; left:-99999px; top:0; width:${A4_W}px; background:#fff;`;
  holder.innerHTML = html;
  document.body.appendChild(holder);

  // Wait a frame so layout settles
  await new Promise((r) => requestAnimationFrame(() => r(null)));

  // We use html2canvas via dynamic import to avoid bundling if unused — but it's not installed here.
  // Fallback: use foreignObject SVG rasterization.
  const totalH = holder.scrollHeight;
  const pageCount = Math.max(1, Math.ceil(totalH / A4_H));
  const pages: RenderedPage[] = [];

  // Serialize once
  const serialized = new XMLSerializer().serializeToString(holder);
  const style = `<style>*{box-sizing:border-box}</style>`;

  for (let i = 0; i < pageCount; i++) {
    const yOffset = i * A4_H;
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${A4_W}" height="${A4_H}">
        <foreignObject width="100%" height="100%">
          <div xmlns="http://www.w3.org/1999/xhtml" style="width:${A4_W}px; height:${A4_H}px; overflow:hidden; background:#fff;">
            <div style="transform: translateY(-${yOffset}px);">${style}${serialized}</div>
          </div>
        </foreignObject>
      </svg>`;
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    await new Promise<void>((r, j) => { img.onload = () => r(); img.onerror = j; img.src = url; });
    const scale = 2;
    const canvas = document.createElement('canvas');
    canvas.width = A4_W * scale;
    canvas.height = A4_H * scale;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);
    pages.push({ pageNum: i + 1, canvas, width: canvas.width, height: canvas.height });
  }

  document.body.removeChild(holder);
  return pages;
}
