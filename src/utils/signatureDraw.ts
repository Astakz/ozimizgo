import { getStroke } from 'perfect-freehand';

export type Point = [number, number, number]; // x, y, pressure

// Convert perfect-freehand outline points into SVG path string
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

export function strokesToSvg(
  strokes: Point[][],
  width: number,
  height: number,
  color = '#0b2545',
): string {
  const paths = strokes.map((stroke) => {
    const outline = getStroke(stroke, {
      size: 3.2,
      thinning: 0.65,
      smoothing: 0.6,
      streamline: 0.55,
      easing: (t) => t,
      simulatePressure: true,
      last: true,
    });
    return `<path d="${getSvgPathFromStroke(outline)}" fill="${color}"/>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">${paths.join('')}</svg>`;
}

export function svgToDataUrl(svg: string): string {
  return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
}

// Rasterize SVG to PNG data URL at target size (transparent bg) — for pdf-lib embedding
export async function svgToPngDataUrl(svg: string, scale = 2): Promise<string> {
  const img = new Image();
  const url = svgToDataUrl(svg);
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = url;
  });
  const w = img.width * scale;
  const h = img.height * scale;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL('image/png');
}
