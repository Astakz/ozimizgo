import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PenLine, Type as TypeIcon, Upload, RotateCcw, Undo2, Redo2, Check } from 'lucide-react';
import {
  strokeToOutline,
  strokesToTightSvg,
  svgToDataUrl,
  svgToPngDataUrl,
  type Point,
  type PenOptions,
  type SignatureResult,
} from '@/utils/signatureDraw';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Called with a signature result. For legacy callers, `dataUrl` is a string. */
  onSave: (result: SignatureResult | string) => void;
  /** Output format. 'svg' (default) preserves vector quality. 'png' rasterizes. */
  format?: 'svg' | 'png';
  /** Return type: object (default, richer) or string (legacy). */
  legacy?: boolean;
}

const THICKNESS_PRESETS = [
  { key: 'xthin',  label: 'X-Thin',  size: 1.6 },
  { key: 'thin',   label: 'Thin',    size: 2.4 },
  { key: 'medium', label: 'Medium',  size: 3.4 },
  { key: 'thick',  label: 'Thick',   size: 5.0 },
  { key: 'xthick', label: 'X-Thick', size: 7.0 },
];

const COLORS = [
  { key: 'blue',     label: 'Blue',      value: '#1E56C7' },
  { key: 'darkblue', label: 'Dark blue', value: '#0B2545' },
  { key: 'black',    label: 'Black',     value: '#111111' },
];

export function SignatureModal({ open, onClose, onSave, format = 'svg', legacy = false }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Strokes stored in CSS-pixel coordinates (device-independent)
  const [undoStack, setUndoStack] = useState<Point[][]>([]);
  const [redoStack, setRedoStack] = useState<Point[][]>([]);
  const [current, setCurrent] = useState<Point[] | null>(null);
  const [size, setSize] = useState(3.4);
  const [color, setColor] = useState<string>('#1E56C7');
  const [typed, setTyped] = useState('');
  const [uploaded, setUploaded] = useState<string | null>(null);
  const [tab, setTab] = useState('draw');
  const cssSize = useRef({ w: 0, h: 0 });

  const penOpts: PenOptions = useMemo(() => ({ size, color }), [size, color]);

  const resize = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const parent = c.parentElement!;
    const r = parent.getBoundingClientRect();
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const cssW = r.width;
    const cssH = 260;
    cssSize.current = { w: cssW, h: cssH };
    c.width = Math.round(cssW * dpr);
    c.height = Math.round(cssH * dpr);
    c.style.width = cssW + 'px';
    c.style.height = cssH + 'px';
    const ctx = c.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }, []);

  useEffect(() => {
    if (!open) return;
    setUndoStack([]); setRedoStack([]); setCurrent(null);
    setTyped(''); setUploaded(null); setTab('draw');
    setSize(3.4); setColor('#1E56C7');
    const raf = requestAnimationFrame(resize);
    window.addEventListener('resize', resize);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, [open, resize]);

  const draw = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d')!;
    const { w, h } = cssSize.current;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = color;
    const all = current ? [...undoStack, current] : undoStack;
    for (const s of all) {
      const outline = strokeToOutline(s, penOpts);
      if (outline.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(outline[0][0], outline[0][1]);
      for (let i = 1; i < outline.length; i++) ctx.lineTo(outline[i][0], outline[i][1]);
      ctx.closePath();
      ctx.fill();
    }
  }, [undoStack, current, color, penOpts]);

  useEffect(() => { draw(); }, [draw]);

  const point = (e: React.PointerEvent): Point => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const pressure = (e as any).pressure && (e as any).pressure > 0 ? (e as any).pressure : 0.5;
    return [e.clientX - rect.left, e.clientY - rect.top, pressure];
  };

  const onDown = (e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setCurrent([point(e)]);
    setRedoStack([]);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!current) return;
    // coalesced events for smoother capture
    const evts: PointerEvent[] = (e.nativeEvent as any).getCoalescedEvents?.() ?? [e.nativeEvent];
    const rect = canvasRef.current!.getBoundingClientRect();
    const pts: Point[] = evts.map((ev) => [ev.clientX - rect.left, ev.clientY - rect.top, ev.pressure && ev.pressure > 0 ? ev.pressure : 0.5]);
    setCurrent((s) => (s ? [...s, ...pts] : s));
  };
  const onUp = () => {
    if (current && current.length > 1) setUndoStack((s) => [...s, current]);
    setCurrent(null);
  };

  const undo = () => {
    setUndoStack((s) => {
      if (!s.length) return s;
      const last = s[s.length - 1];
      setRedoStack((r) => [...r, last]);
      return s.slice(0, -1);
    });
  };
  const redo = () => {
    setRedoStack((r) => {
      if (!r.length) return r;
      const last = r[r.length - 1];
      setUndoStack((s) => [...s, last]);
      return r.slice(0, -1);
    });
  };
  const clear = () => { setUndoStack([]); setRedoStack([]); };

  const emit = (r: SignatureResult) => onSave(legacy ? r.dataUrl : r);

  const handleSave = async () => {
    if (tab === 'draw') {
      if (!undoStack.length) return;
      const { svg, width, height } = strokesToTightSvg(undoStack, penOpts);
      if (!width || !height) return;
      if (format === 'png') {
        const targetW = Math.max(1200, Math.round(width * 3));
        const png = await svgToPngDataUrl(svg, targetW);
        emit({ dataUrl: png, naturalWidth: width, naturalHeight: height, vector: false });
      } else {
        emit({ dataUrl: svgToDataUrl(svg), naturalWidth: width, naturalHeight: height, vector: true });
      }
    } else if (tab === 'type') {
      const value = typed.trim();
      if (!value) return;
      const w = 900;
      const h = 240;
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><text x="${w/2}" y="${h*0.7}" text-anchor="middle" font-family="'Brush Script MT','Segoe Script','Lucida Handwriting',cursive" font-size="140" fill="${color}">${escapeXml(value)}</text></svg>`;
      if (format === 'png') {
        const png = await svgToPngDataUrl(svg, 1600);
        emit({ dataUrl: png, naturalWidth: w, naturalHeight: h, vector: false });
      } else {
        emit({ dataUrl: svgToDataUrl(svg), naturalWidth: w, naturalHeight: h, vector: true });
      }
    } else if (tab === 'upload') {
      if (!uploaded) return;
      const img = new Image();
      await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = rej; img.src = uploaded; });
      emit({ dataUrl: uploaded, naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight, vector: false });
    }
  };

  const handleUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => setUploaded(reader.result as string);
    reader.readAsDataURL(file);
  };

  const hasContent = tab === 'draw' ? undoStack.length > 0 : tab === 'type' ? typed.trim().length > 0 : !!uploaded;

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

          <TabsContent value="draw" className="space-y-4 mt-0">
            {/* Pen settings */}
            <div className="rounded-2xl border bg-slate-50/60 dark:bg-muted/30 px-4 py-3 space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Color</span>
                <div className="flex items-center gap-2">
                  {COLORS.map((c) => (
                    <button
                      key={c.key}
                      onClick={() => setColor(c.value)}
                      title={c.label}
                      className={`w-7 h-7 rounded-full border-2 transition-all ${color === c.value ? 'ring-2 ring-offset-2 ring-primary scale-110' : 'border-white shadow'}`}
                      style={{ background: c.value }}
                    />
                  ))}
                </div>
                <div className="hidden sm:block w-px h-6 bg-border" />
                <div className="flex items-center gap-1.5">
                  {THICKNESS_PRESETS.map((p) => (
                    <button
                      key={p.key}
                      onClick={() => setSize(p.size)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${Math.abs(size - p.size) < 0.05 ? 'bg-primary text-primary-foreground border-primary shadow' : 'bg-white dark:bg-card hover:border-primary/50'}`}
                    >
                      <span className="inline-block align-middle mr-1 rounded-full" style={{ width: 12, height: Math.max(2, p.size), background: color }} />
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap">Thickness</span>
                <Slider min={1} max={10} step={0.1} value={[size]} onValueChange={(v) => setSize(v[0])} className="flex-1" />
                <span className="text-xs tabular-nums w-10 text-right text-muted-foreground">{size.toFixed(1)}px</span>
              </div>
            </div>

            <div className="relative bg-white border-2 border-dashed border-slate-200 rounded-2xl overflow-hidden">
              <canvas
                ref={canvasRef}
                onPointerDown={onDown}
                onPointerMove={onMove}
                onPointerUp={onUp}
                onPointerCancel={onUp}
                onPointerLeave={(e) => { if (e.buttons === 0) onUp(); }}
                className="w-full touch-none cursor-crosshair block select-none"
                style={{ height: 260 }}
              />
              <div className="absolute bottom-6 left-8 right-8 border-b border-slate-300 pointer-events-none" />
              <div className="absolute bottom-2 left-8 text-[10px] uppercase tracking-widest text-slate-400 pointer-events-none">Sign above</div>
              {!undoStack.length && !current && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-300 text-sm">
                  Draw your signature
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={undo} disabled={!undoStack.length}><Undo2 className="w-4 h-4 mr-1" />Undo</Button>
                <Button variant="outline" size="sm" onClick={redo} disabled={!redoStack.length}><Redo2 className="w-4 h-4 mr-1" />Redo</Button>
                <Button variant="outline" size="sm" onClick={clear} disabled={!undoStack.length && !redoStack.length}><RotateCcw className="w-4 h-4 mr-1" />Clear</Button>
              </div>
              <p className="text-xs text-muted-foreground">Vector signature · lossless at any zoom</p>
            </div>
          </TabsContent>

          <TabsContent value="type" className="space-y-3 mt-0">
            <Input placeholder="Your full name" value={typed} onChange={(e) => setTyped(e.target.value)} className="h-12 text-lg" />
            <div className="bg-white border rounded-2xl h-40 flex items-center justify-center">
              <div style={{ fontFamily: "'Brush Script MT','Segoe Script','Lucida Handwriting',cursive", fontSize: 56, color }}>
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
            <Button onClick={handleSave} disabled={!hasContent} className="bg-gradient-to-r from-primary to-primary/80">
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
