import { useRef, useState, useCallback, useEffect } from 'react';
import { getStroke } from 'perfect-freehand';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PenLine, Type as TypeIcon, Upload, RotateCcw, Undo2, Check } from 'lucide-react';
import { strokesToSvg, svgToPngDataUrl, type Point } from '@/utils/signatureDraw';

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (pngDataUrl: string) => void;
}

export function SignatureModal({ open, onClose, onSave }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [strokes, setStrokes] = useState<Point[][]>([]);
  const [current, setCurrent] = useState<Point[] | null>(null);
  const [typed, setTyped] = useState('');
  const [uploaded, setUploaded] = useState<string | null>(null);
  const [tab, setTab] = useState('draw');

  const resize = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const parent = c.parentElement!;
    const r = parent.getBoundingClientRect();
    c.width = r.width * devicePixelRatio;
    c.height = 240 * devicePixelRatio;
    c.style.width = r.width + 'px';
    c.style.height = '240px';
  }, []);

  useEffect(() => {
    if (!open) return;
    setStrokes([]); setCurrent(null); setTyped(''); setUploaded(null); setTab('draw');
    requestAnimationFrame(resize);
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [open, resize]);

  const draw = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d')!;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.fillStyle = '#0b2545';
    const all = current ? [...strokes, current] : strokes;
    for (const s of all) {
      const outline = getStroke(s, {
        size: 3.2 * devicePixelRatio,
        thinning: 0.65, smoothing: 0.6, streamline: 0.55,
        simulatePressure: true,
      });
      if (outline.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(outline[0][0], outline[0][1]);
      for (let i = 1; i < outline.length; i++) ctx.lineTo(outline[i][0], outline[i][1]);
      ctx.closePath();
      ctx.fill();
    }
  }, [strokes, current]);

  useEffect(() => { draw(); }, [draw]);

  const point = (e: React.PointerEvent): Point => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return [
      (e.clientX - rect.left) * devicePixelRatio,
      (e.clientY - rect.top) * devicePixelRatio,
      (e as any).pressure || 0.5,
    ];
  };

  const onDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setCurrent([point(e)]);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!current) return;
    setCurrent((s) => (s ? [...s, point(e)] : s));
  };
  const onUp = () => {
    if (current && current.length > 1) setStrokes((s) => [...s, current]);
    setCurrent(null);
  };

  const undo = () => setStrokes((s) => s.slice(0, -1));
  const clear = () => setStrokes([]);

  const handleSave = async () => {
    if (tab === 'draw') {
      if (!strokes.length) return;
      const c = canvasRef.current!;
      // Trim to used area & rebuild SVG in CSS-pixel coords
      const cssStrokes = strokes.map((s) => s.map(([x, y, p]) => [x / devicePixelRatio, y / devicePixelRatio, p] as Point));
      const svg = strokesToSvg(cssStrokes, c.width / devicePixelRatio, c.height / devicePixelRatio);
      const png = await svgToPngDataUrl(svg, 2);
      onSave(png);
    } else if (tab === 'type') {
      if (!typed.trim()) return;
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="140" viewBox="0 0 480 140"><text x="240" y="95" text-anchor="middle" font-family="'Brush Script MT','Segoe Script',cursive" font-size="72" fill="#0b2545">${escapeXml(typed)}</text></svg>`;
      const png = await svgToPngDataUrl(svg, 2);
      onSave(png);
    } else if (tab === 'upload') {
      if (uploaded) onSave(uploaded);
    }
  };

  const handleUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => setUploaded(reader.result as string);
    reader.readAsDataURL(file);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle className="text-2xl">Your signature</DialogTitle>
        </DialogHeader>
        <Tabs value={tab} onValueChange={setTab} className="px-6 pb-6">
          <TabsList className="grid grid-cols-3 w-full mb-4">
            <TabsTrigger value="draw"><PenLine className="w-4 h-4 mr-2" />Draw</TabsTrigger>
            <TabsTrigger value="type"><TypeIcon className="w-4 h-4 mr-2" />Type</TabsTrigger>
            <TabsTrigger value="upload"><Upload className="w-4 h-4 mr-2" />Upload</TabsTrigger>
          </TabsList>

          <TabsContent value="draw" className="space-y-3 mt-0">
            <div className="relative bg-gradient-to-b from-white to-slate-50 border-2 border-dashed border-slate-200 rounded-2xl overflow-hidden">
              <canvas
                ref={canvasRef}
                onPointerDown={onDown}
                onPointerMove={onMove}
                onPointerUp={onUp}
                onPointerLeave={onUp}
                className="w-full touch-none cursor-crosshair block"
                style={{ height: 240 }}
              />
              <div className="absolute bottom-4 left-6 right-6 border-b border-slate-300 pointer-events-none" />
              {!strokes.length && !current && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-300 text-sm">
                  Sign here
                </div>
              )}
            </div>
            <div className="flex justify-between">
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={undo} disabled={!strokes.length}><Undo2 className="w-4 h-4 mr-1" />Undo</Button>
                <Button variant="outline" size="sm" onClick={clear} disabled={!strokes.length}><RotateCcw className="w-4 h-4 mr-1" />Clear</Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="type" className="space-y-3 mt-0">
            <Input placeholder="Your full name" value={typed} onChange={(e) => setTyped(e.target.value)} className="h-12 text-lg" />
            <div className="bg-slate-50 border rounded-2xl h-40 flex items-center justify-center">
              <div style={{ fontFamily: "'Brush Script MT','Segoe Script',cursive", fontSize: 56, color: '#0b2545' }}>
                {typed || 'Preview'}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="upload" className="space-y-3 mt-0">
            <label className="flex flex-col items-center justify-center h-40 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl cursor-pointer hover:bg-slate-100">
              <Upload className="w-8 h-8 text-slate-400 mb-2" />
              <span className="text-sm text-slate-500">PNG with transparent background</span>
              <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])} />
            </label>
            {uploaded && (
              <div className="bg-white border rounded-2xl p-4 flex justify-center">
                <img src={uploaded} alt="signature" className="max-h-32" />
              </div>
            )}
          </TabsContent>

          <div className="flex justify-end gap-2 mt-6">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} className="bg-gradient-to-r from-primary to-primary/80">
              <Check className="w-4 h-4 mr-1" />Apply signature
            </Button>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function escapeXml(s: string) {
  return s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!);
}
