import { getStroke } from 'perfect-freehand';

export type Point = [number, number, number]; // x, y, pressure (0..1)

export interface PenOptions {
  size: number;                 // base thickness (CSS px)
  color: string;                // hex color
  thinning?: number;            // -1..1
  smoothing?: number;           // 0..1
  streamline?: number;          // 0..1
  simulatePressure?: boolean;
}

const DEFAULTS: Required<Omit<PenOptions, 'size' | 'color'>> = {
  thinning: 0.62,
  smoothing: 0.58,
  streamline: 0.5,
  simulatePressure: true,
};

// Convert perfect-freehand outline points into a compact SVG path string
export function getSvgPathFromStroke(points: number[][]): string {
  if (!points.length) return '';
  const d = points.reduce(
    (acc, [x0, y0], i, arr) => {
      const [x1, y1] = arr[(i + 1) % arr.length];
      acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
      return acc;
    },
    ['M', points[0][0], points[0][1], 'Q'] as (string | number)[],
  );
  d.push('Z');
  return d.join(' ');
}

export function strokeToOutline(stroke: Point[], opts: PenOptions) {
  return getStroke(stroke, {
    size: opts.size,
    thinning: opts.thinning ?? DEFAULTS.thinning,
    smoothing: opts.smoothing ?? DEFAULTS.smoothing,
    streamline: opts.streamline ?? DEFAULTS.streamline,
    simulatePressure: opts.simulatePressure ?? DEFAULTS.simulatePressure,
    easing: (t) => t,
    last: true,
  });
}

export function strokeToPathString(stroke: Point[], opts: PenOptions): string {
  return getSvgPathFromStroke(strokeToOutline(stroke, opts));
}

export interface StrokeBounds { x: number; y: number; w: number; h: number }

export function computeStrokeBounds(strokes: Point[][], opts: PenOptions, pad = 8): StrokeBounds {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const s of strokes) {
    const outline = strokeToOutline(s, opts);
    for (const [x, y] of outline) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (!isFinite(minX)) return { x: 0, y: 0, w: 1, h: 1 };
  return {
    x: minX - pad,
    y: minY - pad,
    w: (maxX - minX) + pad * 2,
    h: (maxY - minY) + pad * 2,
  };
}

// Build a tight, transparent SVG that contains all strokes, cropped to their bounds.
export function strokesToTightSvg(strokes: Point[][], opts: PenOptions): { svg: string; width: number; height: number } {
  if (!strokes.length) return { svg: '', width: 0, height: 0 };
  const b = computeStrokeBounds(strokes, opts);
  const paths = strokes
    .map((s) => `<path d="${strokeToPathString(s, opts)}" fill="${opts.color}" fill-rule="nonzero"/>`)
    .join('');
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${b.x} ${b.y} ${b.w} ${b.h}" width="${b.w}" height="${b.h}" shape-rendering="geometricPrecision">` +
    paths +
    `</svg>`;
  return { svg, width: b.w, height: b.h };
}

export function svgToDataUrl(svg: string): string {
  return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
}

// Rasterize SVG string to a high-res PNG data URL. `targetWidth` in device px.
export async function svgToPngDataUrl(svg: string, targetWidth = 1200): Promise<string> {
  const url = svgToDataUrl(svg);
  const img = new Image();
  img.decoding = 'sync' as any;
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = url;
  });
  const ratio = img.height / img.width || 1;
  const w = Math.max(1, Math.round(targetWidth));
  const h = Math.max(1, Math.round(targetWidth * ratio));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL('image/png');
}

export interface SignatureResult {
  /** Data URL used for on-screen display and PDF embedding. SVG (vector) by default. */
  dataUrl: string;
  /** Natural intrinsic pixel size of the signature (for aspect ratio) */
  naturalWidth: number;
  naturalHeight: number;
  /** true when dataUrl is an SVG vector image */
  vector: boolean;
}
